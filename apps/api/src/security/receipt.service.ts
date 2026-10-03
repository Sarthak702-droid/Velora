import { Injectable, ForbiddenException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

/** Scoped, expiring capabilities for anonymous customer receipts. Never use display tokens as credentials. */
@Injectable()
export class ReceiptService {
  issue(kind: "booking" | "queue" | "payment", tenantId: string, id: string) {
    const expires =
      Math.floor(Date.now() / 1000) + (kind === "payment" ? 30 : 7) * 86400;
    return `${expires}.${this.signature(kind, tenantId, id, expires)}`;
  }
  verify(
    kind: "booking" | "queue" | "payment",
    tenantId: string,
    id: string,
    receipt?: string,
  ) {
    const [expiry, signature = ""] = (receipt || "").split(".");
    const expires = Number(expiry);
    const expected = this.signature(kind, tenantId, id, expires);
    if (
      !Number.isSafeInteger(expires) ||
      expires < Date.now() / 1000 ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new ForbiddenException("A valid private receipt is required");
    }
  }
  private signature(
    kind: string,
    tenantId: string,
    id: string,
    expires: number,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new Error("JWT_SECRET must be configured for customer receipts");
    return createHmac("sha256", secret)
      .update(`velora-receipt:${kind}:${tenantId}:${id}:${expires}`)
      .digest("hex");
  }
}
