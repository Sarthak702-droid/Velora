import { z } from "zod";
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{8,18}$/, "Enter a valid phone number"),
});
