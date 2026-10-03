-- Additive change; does not reset existing appointments, customers or payments.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'DEPOSIT';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "premiumExpiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "premiumProfile" JSONB;
