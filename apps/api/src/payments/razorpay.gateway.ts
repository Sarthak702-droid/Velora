import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
} from "@nestjs/common";
export type GatewayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};
export type GatewayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  amount_refunded: number;
};
@Injectable()
export class RazorpayGateway {
  configured() {
    const key = process.env.RAZORPAY_KEY_ID || "",
      secret = process.env.RAZORPAY_KEY_SECRET || "";
    return (
      /^rzp_test_[A-Za-z0-9]+$/.test(key) &&
      !/xxxx|demo|replace/i.test(key + secret) &&
      secret.length >= 10
    );
  }
  private credentials() {
    if (!this.configured())
      throw new ServiceUnavailableException(
        "Razorpay test keys are not configured. No payment was created.",
      );
    return {
      keyId: process.env.RAZORPAY_KEY_ID!,
      secret: process.env.RAZORPAY_KEY_SECRET!,
    };
  }
  keyId() {
    return this.credentials().keyId;
  }
  secret() {
    return this.credentials().secret;
  }
  private async call<T>(path: string, body?: unknown): Promise<T> {
    const { keyId, secret } = this.credentials();
    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("Provider rejected request");
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException(
        "Razorpay test gateway is unavailable. Retry or check test credentials.",
      );
    }
  }
  createOrder(amount: number, currency: string, receipt: string) {
    return this.call<GatewayOrder>("orders", { amount, currency, receipt });
  }
  getPayment(id: string) {
    return this.call<GatewayPayment>(`payments/${encodeURIComponent(id)}`);
  }
}
