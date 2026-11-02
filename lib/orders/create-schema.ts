import { z } from "zod"
import { sanitizePlainText } from "@/lib/security/validation"

/** Schema Zod — création commande acheteur (POST /api/orders). */
export const orderCreateSchema = z.object({
  seller_id: z.string().uuid("seller_id invalide"),
  payment_method: z
    .string()
    .min(1)
    .max(40)
    .default("geniuspay")
    .transform((v) => sanitizePlainText(v, 40)),
  shipping_address: z
    .string()
    .max(400)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 400) : "")),
  shipping_city: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 120) : "")),
  shipping_country: z
    .string()
    .max(8)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 8).toLowerCase() : "ci")),
  shipping_phone: z
    .string()
    .max(30)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 30) : "")),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("product_id invalide"),
        quantity: z.coerce.number().int().min(1).max(999_999),
      }),
    )
    .min(1)
    .max(50),
})

export type OrderCreateInput = z.infer<typeof orderCreateSchema>
