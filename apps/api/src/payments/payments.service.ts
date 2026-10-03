import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { PaymentStatus } from '@prisma/client';

export interface CreateDepositOrderDto {
  appointmentId: string;
  amount: number;
}

export interface VerifyPaymentDto {
  paymentId: string;
  orderId: string;
  signature: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async createDepositOrder(tenantId: string, dto: CreateDepositOrderDto) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: dto.appointmentId, tenantId },
      include: { customer: true, branch: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    const profile = await this.prisma.salonProfile.findUnique({
      where: { tenantId },
    });

    if (profile?.depositType === 'NONE') {
      return { status: PaymentStatus.NOT_REQUIRED, message: 'Deposit not required for this salon' };
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const payment = await this.prisma.payment.upsert({
      where: { appointmentId: appointment.id },
      create: {
        tenantId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        amount: dto.amount,
        status: PaymentStatus.PENDING,
        provider: 'RAZORPAY',
        orderId,
      },
      update: {
        amount: dto.amount,
        status: PaymentStatus.PENDING,
        orderId,
      },
    });

    return {
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_velora_demo_key',
    };
  }

  /**
   * Verify Razorpay Payment Signature (Section 85.28)
   * Backend verifies signature using HMAC SHA256 timing-safe comparison
   */
  async verifyPayment(tenantId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, tenantId },
      include: { appointment: true },
    });

    if (!payment) throw new NotFoundException('Order not found');

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'velora_demo_secret_key_test_123';
    const payload = `${dto.orderId}|${dto.paymentId}`;
    const isValid = this.securityService.verifyHmacSignature(payload, dto.signature, keySecret);

    if (!isValid) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new UnauthorizedException('Payment signature verification failed. Untrusted request.');
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paymentId: dto.paymentId,
        signature: dto.signature,
      },
    });

    this.logger.log(`Payment confirmed for order ${dto.orderId}: ₹${payment.amount}`);
    return { success: true, payment: updated };
  }

  /**
   * Webhook Signature Verification (Section 85.29)
   */
  async handleRazorpayWebhook(signature: string, rawBody: string) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'velora_webhook_secret_verification_xyz';
    const isValid = this.securityService.verifyHmacSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (event === 'payment.captured') {
      const orderId = payload.payload?.payment?.entity?.order_id;
      if (orderId) {
        await this.prisma.payment.updateMany({
          where: { orderId },
          data: { status: PaymentStatus.PAID },
        });
      }
    }

    return { received: true };
  }
}
