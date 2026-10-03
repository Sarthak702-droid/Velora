export type PaymentOrder = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mode: "test";
};
type PaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type Checkout = {
  open: () => void;
  on: (event: string, fn: () => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => Checkout;
  }
}
let scriptPromise: Promise<void> | null = null;
async function loadCheckout() {
  if (window.Razorpay) return;
  if (!scriptPromise)
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        scriptPromise = null;
        reject(
          Error(
            "Payment checkout could not load. Check your connection and retry.",
          ),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        if (window.Razorpay) resolve();
        else {
          script.remove();
          scriptPromise = null;
          reject(Error("Razorpay checkout is unavailable"));
        }
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        scriptPromise = null;
        reject(Error("Payment checkout could not load. Retry shortly."));
      };
      document.head.appendChild(script);
    });
  await scriptPromise;
}
export async function openTestCheckout(
  order: PaymentOrder,
  customer: { name: string; phone: string; email: string },
) {
  if (order.mode !== "test" || !order.keyId.startsWith("rzp_test_"))
    throw Error("Only Razorpay test checkout is enabled");
  await loadCheckout();
  return new Promise<PaymentResponse>((resolve, reject) => {
    let failed = false;
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Velora Privé",
      description: "30-day premium pass · TEST payment",
      prefill: {
        name: customer.name,
        contact: customer.phone,
        email: customer.email,
      },
      theme: { color: "#a67a40" },
      handler: resolve,
      modal: {
        ondismiss: () =>
          reject(
            Error(
              failed
                ? "Test payment failed. Membership was not activated."
                : "Checkout closed. Membership remains locked until payment is verified.",
            ),
          ),
      },
    });
    // Checkout itself offers retry; keep listening for the eventual success handler.
    checkout.on("payment.failed", () => {
      failed = true;
    });
    checkout.open();
  });
}
