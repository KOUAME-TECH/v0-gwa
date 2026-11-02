import { z } from "zod"
import { sanitizePlainText } from "@/lib/security/validation"

export const subscriptionRequestSchema = z.object({
  tier: z.enum(["starter", "pro", "enterprise"]),
  note: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 500) : "")),
})
