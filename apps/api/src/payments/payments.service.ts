import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityService } from "../security/security.service";
import { ReceiptService } from "../security/receipt.service";
import { RazorpayGateway, GatewayPayment } from "./razorpay.gateway";
import {
  CreateDepositOrderDto,
  CreatePremiumOrderDto,
  VerifyPaymentDto,
  PremiumProfileDto,
  ConciergeDto,
} from "./payments.dto";
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly receipts: ReceiptService,
    private readonly gateway: RazorpayGateway,
  ) {}
  premiumAmount() {
    const amount = Number(process.env.PREMIUM_PRICE_PAISE || "49900");
    if (!Number.isSafeInteger(amount) || amount < 100)
      throw new ServiceUnavailableException(
        "Invalid premium price configuration",
      );
    return amount;
  }
  config() {
    return {
      configured: this.gateway.configured(),
      mode: "test",
      amount: this.premiumAmount(),
      currency: "INR",
      days: 30,
      features: ["style-passport", "beauty-concierge"],
    };
  }
  async createPremiumOrder(tenantId: string, dto: CreatePremiumOrderDto) {
    this.gateway.keyId();
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, status: "ACTIVE" },
    });
    if (!tenant) throw new NotFoundException("Salon not found");
    // A supplied phone number is contact information, not proof of identity.
    const customer = await this.prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone: dto.customerPhone } },
      create: {
        tenantId,
        name: dto.customerName,
        phone: dto.customerPhone,
        email: dto.customerEmail,
        marketingConsent: false,
      },
      update: {},
    });
    return this.createOrder(
      tenantId,
      customer.id,
      this.premiumAmount(),
      "INR",
      "PREMIUM",
    );
  }
  async createDepositOrder(
    tenantId: string,
    dto: CreateDepositOrderDto,
    receipt?: string,
  ) {
    this.receipts.verify("booking", tenantId, dto.appointmentId, receipt);
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: dto.appointmentId, tenantId },
      include: { branch: true },
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    if (appointment.status !== "CONFIRMED")
      throw new BadRequestException(
        "Only confirmed appointments can accept a deposit",
      );
    const profile = await this.prisma.salonProfile.findUnique({
      where: { tenantId },
    });
    if (!profile || profile.depositType === "NONE")
      return {
        status: PaymentStatus.NOT_REQUIRED,
        message: "No deposit required",
      };
    if (!["FLAT", "PERCENTAGE"].includes(profile.depositType))
      throw new BadRequestException("Invalid deposit configuration");
    const amount = Math.round(
      Math.min(
        appointment.totalPrice,
        profile.depositType === "PERCENTAGE"
          ? (appointment.totalPrice * profile.depositAmount) / 100
          : profile.depositAmount,
      ) * 100,
    );
    if (
      !Number.isSafeInteger(amount) ||
      amount < 100 ||
      appointment.branch.currency !== "INR"
    )
      throw new BadRequestException(
        "Invalid deposit amount or unsupported test currency",
      );
    const existing = await this.prisma.payment.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (existing?.status === "PAID")
      throw new BadRequestException("Deposit is already paid");
    if (existing?.orderId && existing.status === "PENDING")
      return this.checkout(existing);
    return this.createOrder(
      tenantId,
      appointment.customerId,
      amount,
      "INR",
      "DEPOSIT",
      appointment.id,
    );
  }
  private async createOrder(
    tenantId: string,
    customerId: string,
    amount: number,
    currency: string,
    purpose: string,
    appointmentId?: string,
  ) {
    const order = await this.gateway.createOrder(
      amount,
      currency,
      randomUUID(),
    );
    if (
      !order.id?.startsWith("order_") ||
      order.amount !== amount ||
      order.currency !== currency
    )
      throw new BadRequestException("Unexpected Razorpay order response");
    const data = {
      tenantId,
      customerId,
      amount: amount / 100,
      currency,
      purpose,
      orderId: order.id,
      status: PaymentStatus.PENDING,
      provider: "RAZORPAY_TEST",
    };
    const payment = appointmentId
      ? await this.prisma.payment.upsert({
          where: { appointmentId },
          create: { ...data, appointmentId },
          update: data,
        })
      : await this.prisma.payment.create({ data });
    return this.checkout(payment);
  }
  private checkout(payment: {
    id: string;
    tenantId: string;
    orderId: string | null;
    amount: number;
    currency: string;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: Math.round(payment.amount * 100),
      currency: payment.currency,
      keyId: this.gateway.keyId(),
      mode: "test",
      managementReceipt: this.receipts.issue(
        "payment",
        payment.tenantId,
        payment.id,
      ),
    };
  }
  async resumeCheckout(tenantId: string, id: string, receipt?: string) {
    const p = await this.getOwned(tenantId, id, receipt);
    if (p.status !== "PENDING")
      throw new BadRequestException("This order cannot be paid again");
    return this.checkout(p);
  }
  async getOwned(tenantId: string, id: string, receipt?: string) {
    this.receipts.verify("payment", tenantId, id, receipt);
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId, provider: "RAZORPAY_TEST" },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }
  private validCapture(
    payment: { orderId: string | null; amount: number; currency: string },
    capture: GatewayPayment,
  ) {
    return (
      capture.order_id === payment.orderId &&
      capture.amount === Math.round(payment.amount * 100) &&
      capture.currency === payment.currency &&
      capture.status === "captured" &&
      capture.amount_refunded === 0
    );
  }
  async verifyPayment(
    tenantId: string,
    id: string,
    dto: VerifyPaymentDto,
    receipt?: string,
  ) {
    const payment = await this.getOwned(tenantId, id, receipt);
    if (
      dto.orderId !== payment.orderId ||
      !this.security.verifyHmacSignature(
        `${payment.orderId}|${dto.paymentId}`,
        dto.signature,
        this.gateway.secret(),
      )
    )
      throw new UnauthorizedException("Payment signature verification failed");
    const captured = await this.gateway.getPayment(dto.paymentId);
    if (captured.id !== dto.paymentId || !this.validCapture(payment, captured))
      throw new BadRequestException(
        "Payment is not captured for the expected order, amount and currency",
      );
    await this.markCaptured(payment, captured);
    return this.status(tenantId, id, receipt);
  }
  private async markCaptured(
    payment: { id: string; purpose: string; status: PaymentStatus },
    capture: GatewayPayment,
  ) {
    if (!["PENDING", "PAID"].includes(payment.status))
      throw new ForbiddenException(
        "This payment can no longer activate membership",
      );
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.PAID,
        paymentId: capture.id,
        ...(payment.purpose === "PREMIUM"
          ? { premiumExpiresAt: new Date(Date.now() + 30 * 86400000) }
          : {}),
      },
    });
  }
  async status(tenantId: string, id: string, receipt?: string) {
    const payment = await this.getOwned(tenantId, id, receipt);
    return {
      id: payment.id,
      status: payment.status,
      purpose: payment.purpose,
      expiresAt: payment.premiumExpiresAt,
      active:
        payment.purpose === "PREMIUM" &&
        payment.status === "PAID" &&
        !!payment.premiumExpiresAt &&
        payment.premiumExpiresAt.getTime() > Date.now(),
    };
  }
  async requirePremium(tenantId: string, id: string, receipt?: string) {
    const payment = await this.getOwned(tenantId, id, receipt);
    if (
      payment.purpose !== "PREMIUM" ||
      payment.status !== "PAID" ||
      !payment.premiumExpiresAt ||
      payment.premiumExpiresAt.getTime() <= Date.now()
    )
      throw new ForbiddenException(
        "An active paid premium membership is required",
      );
    return payment;
  }
  async passport(tenantId: string, id: string, receipt?: string) {
    const p = await this.requirePremium(tenantId, id, receipt);
    return (
      p.premiumProfile || { lookName: "", styleNotes: "", preferences: "" }
    );
  }
  async savePassport(
    tenantId: string,
    id: string,
    dto: PremiumProfileDto,
    receipt?: string,
  ) {
    await this.requirePremium(tenantId, id, receipt);
    await this.prisma.payment.update({
      where: { id },
      data: { premiumProfile: { ...dto } },
    });
    return dto;
  }
  async concierge(
    tenantId: string,
    id: string,
    dto: ConciergeDto,
    receipt?: string,
  ) {
    await this.requirePremium(tenantId, id, receipt);
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId, active: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    const services = await this.prisma.service.findMany({
      where: {
        tenantId,
        active: true,
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      },
      orderBy: { price: "asc" },
    });
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        active: true,
        schedules: { some: { branchId: branch.id, isWorkingDay: true } },
      },
      include: { services: true },
    });
    return services
      .filter(
        (s) =>
          s.price <= dto.budget &&
          s.duration <= dto.minutes &&
          staff.some((p) => p.services.some((v) => v.serviceId === s.id)),
      )
      .slice(0, 4)
      .map((s) => ({
        serviceId: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        description: s.description,
        branchId: branch.id,
        currency: branch.currency,
      }));
  }
  async handleRazorpayWebhook(signature: string, rawBody: Buffer) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || /xxxx|demo|replace/i.test(secret))
      throw new ServiceUnavailableException(
        "Razorpay webhook secret is not configured",
      );
    if (
      !this.security.verifyHmacSignature(
        rawBody.toString("utf8"),
        signature || "",
        secret,
      )
    )
      throw new UnauthorizedException("Invalid Razorpay webhook signature");
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new BadRequestException("Invalid webhook body");
    }
    const event = payload.event,
      entity = payload.payload?.payment?.entity;
    if (event === "payment.captured" && entity?.id) {
      const p = await this.prisma.payment.findFirst({
        where: { orderId: entity.order_id, provider: "RAZORPAY_TEST" },
      });
      if (p) {
        const capture = await this.gateway.getPayment(entity.id);
        if (capture.id !== entity.id || !this.validCapture(p, capture))
          throw new BadRequestException("Webhook payment does not match order");
        await this.markCaptured(p, capture);
      }
    }
    if (
      event === "refund.processed" &&
      payload.payload?.refund?.entity?.payment_id
    ) {
      const id = payload.payload.refund.entity.payment_id;
      const capture = await this.gateway.getPayment(id);
      if (capture.amount_refunded > 0)
        await this.prisma.payment.updateMany({
          where: { paymentId: id, provider: "RAZORPAY_TEST" },
          data: { status: PaymentStatus.REFUNDED },
        });
    }
    return { received: true };
  }
}
