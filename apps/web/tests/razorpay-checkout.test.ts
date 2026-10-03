import { describe, it, expect, vi, afterEach } from "vitest";
import {
  openTestCheckout,
  type PaymentOrder,
} from "../src/lib/razorpay-checkout";
afterEach(() => vi.unstubAllGlobals());
const order: PaymentOrder = {
  id: "private-id",
  keyId: "rzp_test_fixture",
  orderId: "order_server",
  amount: 49900,
  currency: "INR",
  mode: "test",
};
const customer = { name: "Customer", phone: "+910000000000", email: "" };
function setup() {
  let options: any;
  let failed: () => void = () => {};
  vi.stubGlobal("window", {
    Razorpay: class {
      constructor(input: any) {
        options = input;
      }
      on(_name: string, fn: () => void) {
        failed = fn;
      }
      open() {}
    },
  });
  return { options: () => options, failed: () => failed() };
}
describe("test checkout lifecycle", () => {
  it("uses server order/price and allows retry after a failed payment", async () => {
    const s = setup();
    const result = openTestCheckout(order, customer);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.options().order_id).toBe("order_server");
    expect(s.options().amount).toBe(49900);
    s.failed();
    s.options().handler({
      razorpay_order_id: "order_server",
      razorpay_payment_id: "pay_test",
      razorpay_signature: "test-signature",
    });
    expect((await result).razorpay_payment_id).toBe("pay_test");
  });
  it("closing checkout after failure reports failure without activating membership", async () => {
    const s = setup();
    const result = openTestCheckout(order, customer);
    const rejection = expect(result).rejects.toThrow("not activated");
    await Promise.resolve();
    await Promise.resolve();
    s.failed();
    s.options().modal.ondismiss();
    await rejection;
  });
  it("refuses live keys before loading checkout", async () => {
    setup();
    await expect(
      openTestCheckout({ ...order, keyId: "rzp_live_fixture" }, customer),
    ).rejects.toThrow("Only Razorpay test");
  });
});
