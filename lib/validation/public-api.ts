import { z } from "zod"

export const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999_999),
})

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
})

export const joinRfqSchema = z.object({
  buyerRequestId: z.string().uuid(),
  volumeCommitted: z.coerce.number().positive(),
  priceOffered: z.coerce.number().nonnegative().nullable().optional(),
})

export function zodErrorMessage(): string {
  return "Certaines informations sont incomplètes. Vérifie et réessaie."
}
