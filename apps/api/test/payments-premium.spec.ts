import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { PaymentsService } from "../src/payments/payments.service";
import { RazorpayGateway } from "../src/payments/razorpay.gateway";
import { SecurityService } from "../src/security/security.service";
import { ReceiptService } from "../src/security/receipt.service";
import type { PrismaService } from "../src/prisma/prisma.service";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function setup() {
  vi.stubEnv("JWT_SECRET", "test-only-private-receipt-secret");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test-only-webhook-secret");
  const row: any = {
    id: "p1",
    tenantId: "tenant-a",
    customerId: "c1",
    orderId: "order_server",
    amount: 499,
    currency: "INR",
    purpose: "PREMIUM",
    provider: "RAZORPAY_TEST",
    status: "PENDING",
    premiumExpiresAt: null,
    premiumProfile: null,
  };
  const prisma: any = {
    payment: {
      findFirst: vi.fn(async (args: any) =>
        args.where.tenantId && args.where.tenantId !== row.tenantId
          ? null
          : row,
      ),
      updateMany: vi.fn(async (args: any) => {
        if (args.where.status && args.where.status !== row.status)
          return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      }),
      update: vi.fn(async (args: any) => {
        Object.assign(row, args.data);
        return row;
      }),
      create: vi.fn(async (args: any) => {
        Object.assign(row, args.data);
        return row;
      }),
    },
    tenant: { findFirst: vi.fn(async () => ({ id: "tenant-a" })) },
    customer: { upsert: vi.fn(async () => ({ id: "c1" })) },
  };
  const captured = {
    id: "pay_test",
    order_id: "order_server",
    amount: 49900,
    currency: "INR",
    status: "captured",
    amount_refunded: 0,
  };
  const gateway: any = {
    keyId: () => "rzp_test_unitkey",
    secret: () => "test-only-razorpay-secret",
    configured: () => true,
    getPayment: vi.fn(async () => ({ ...captured })),
    createOrder: vi.fn(async () => ({
      id: "order_server",
      amount: 49900,
      currency: "INR",
      status: "created",
    })),
  };
  const receipts = new ReceiptService();
  const receipt = receipts.issue("payment", "tenant-a", "p1");
  const service = new PaymentsService(
    prisma as PrismaService,
    new SecurityService(),
    receipts,
    gateway,
  );
  const dto = {
    orderId: "order_server",
    paymentId: "pay_test",
    signature: createHmac("sha256", gateway.secret())
      .update("order_server|pay_test")
      .digest("hex"),
  };
  return { row, prisma, gateway, receipt, receipts, service, dto, captured };
}
describe("test payments and premium server authorization", () => {
  it("requires real test configuration and refuses placeholder/live keys", () => {
    const gateway = new RazorpayGateway();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_xxxxxx");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "xxxxxx");
    expect(gateway.configured()).toBe(false);
    expect(() => gateway.keyId()).toThrow();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_something");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "a-valid-length-secret");
    expect(gateway.configured()).toBe(false);
  });
  it("creates a real provider order with server-owned price and no active membership", async () => {
    const s = setup();
    const order = await s.service.createPremiumOrder("tenant-a", {
      customerName: "Unit Customer",
      customerPhone: "+910000000000",
    });
    expect(s.gateway.createOrder).toHaveBeenCalledWith(
      49900,
      "INR",
      expect.any(String),
    );
    expect(order.amount).toBe(49900);
    expect(s.row.status).toBe("PENDING");
    expect((await s.service.status("tenant-a", "p1", s.receipt)).active).toBe(
      false,
    );
  });
  it("does not grant access for pending, expired, refunded, deposit or missing receipt", async () => {
    const s = setup();
    await expect(
      s.service.requirePremium("tenant-a", "p1", s.receipt),
    ).rejects.toThrow();
    s.row.status = "PAID";
    s.row.premiumExpiresAt = new Date(Date.now() + 100000);
    expect(await s.service.requirePremium("tenant-a", "p1", s.receipt)).toBe(
      s.row,
    );
    await expect(s.service.requirePremium("tenant-a", "p1")).rejects.toThrow();
    await expect(
      s.service.requirePremium("tenant-b", "p1", s.receipt),
    ).rejects.toThrow();
    s.row.purpose = "DEPOSIT";
    await expect(
      s.service.requirePremium("tenant-a", "p1", s.receipt),
    ).rejects.toThrow();
    s.row.purpose = "PREMIUM";
    s.row.status = "REFUNDED";
    await expect(
      s.service.requirePremium("tenant-a", "p1", s.receipt),
    ).rejects.toThrow();
    s.row.status = "PAID";
    s.row.premiumExpiresAt = new Date(Date.now() - 1);
    await expect(
      s.service.requirePremium("tenant-a", "p1", s.receipt),
    ).rejects.toThrow();
  });
  it("rejects signatures/order mismatches without downgrading or changing stored payments", async () => {
    const s = setup();
    await expect(
      s.service.verifyPayment(
        "tenant-a",
        "p1",
        { ...s.dto, signature: "a".repeat(64) },
        s.receipt,
      ),
    ).rejects.toThrow();
    await expect(
      s.service.verifyPayment(
        "tenant-a",
        "p1",
        { ...s.dto, orderId: "order_foreign" },
        s.receipt,
      ),
    ).rejects.toThrow();
    expect(s.prisma.payment.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    { amount: 1 },
    { currency: "USD" },
    { status: "authorized" },
    { order_id: "order_foreign" },
    { amount_refunded: 100 },
    { id: "pay_foreign" },
  ])("rejects mismatched/uncaptured provider payment %j", async (change) => {
    const s = setup();
    s.gateway.getPayment.mockResolvedValue({ ...s.captured, ...change });
    await expect(
      s.service.verifyPayment("tenant-a", "p1", s.dto, s.receipt),
    ).rejects.toThrow();
    expect(s.row.status).toBe("PENDING");
  });
  it("activates only a captured payment and repeat verification does not extend expiry", async () => {
    const s = setup();
    const result = await s.service.verifyPayment(
      "tenant-a",
      "p1",
      s.dto,
      s.receipt,
    );
    expect(result.active).toBe(true);
    const expires = s.row.premiumExpiresAt.getTime();
    await s.service.verifyPayment("tenant-a", "p1", s.dto, s.receipt);
    expect(s.row.premiumExpiresAt.getTime()).toBe(expires);
  });
  it("never reactivates a refunded payment with an old valid signature", async () => {
    const s = setup();
    s.row.status = "REFUNDED";
    await expect(
      s.service.verifyPayment("tenant-a", "p1", s.dto, s.receipt),
    ).rejects.toThrow();
    expect(s.row.status).toBe("REFUNDED");
  });
  it("uses exact raw webhook bytes and rejects invalid signatures", async () => {
    const s = setup();
    const raw = Buffer.from(
      '{ "event": "payment.captured", "payload": {"payment":{"entity":{"id":"pay_test","order_id":"order_server"}}}}',
    );
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest("hex");
    await expect(
      s.service.handleRazorpayWebhook(
        signature,
        Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),
      ),
    ).rejects.toThrow();
    await s.service.handleRazorpayWebhook(signature, raw);
    expect(s.row.status).toBe("PAID");
  });
  it("refund webhooks revoke premium access and reject unknown/missing webhook secrets", async () => {
    const s = setup();
    s.row.status = "PAID";
    s.row.paymentId = "pay_test";
    s.row.premiumExpiresAt = new Date(Date.now() + 100000);
    s.gateway.getPayment.mockResolvedValue({
      ...s.captured,
      amount_refunded: 49900,
    });
    const raw = Buffer.from(
      JSON.stringify({
        event: "refund.processed",
        payload: { refund: { entity: { payment_id: "pay_test" } } },
      }),
    );
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(raw)
      .digest("hex");
    await s.service.handleRazorpayWebhook(signature, raw);
    expect(s.row.status).toBe("REFUNDED");
    await expect(
      s.service.requirePremium("tenant-a", "p1", s.receipt),
    ).rejects.toThrow();
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    await expect(
      s.service.handleRazorpayWebhook(signature, raw),
    ).rejects.toThrow();
  });
  it("passport read/write requires payment entitlement and persists only validated profile", async () => {
    const s = setup();
    const dto = {
      lookName: "Signature",
      styleNotes: "Short sides",
      preferences: "Quiet visit",
    };
    await expect(
      s.service.savePassport("tenant-a", "p1", dto, s.receipt),
    ).rejects.toThrow();
    s.row.status = "PAID";
    s.row.premiumExpiresAt = new Date(Date.now() + 100000);
    await s.service.savePassport("tenant-a", "p1", dto, s.receipt);
    expect(await s.service.passport("tenant-a", "p1", s.receipt)).toEqual(dto);
  });
});
