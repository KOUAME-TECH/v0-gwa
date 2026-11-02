import { z } from "zod"
import { sanitizePlainText } from "@/lib/security/validation"
import {
  DISPUTE_REASONS,
  normalizeDisputeReason,
  mapLitigeDescriptionToReason,
} from "@/lib/orders/escrow-flow"

/** Schema Zod — ouverture litige acheteur/vendeur. */
export const litigeOpenSchema = z.object({
  description: z
    .string()
    .min(10, "Description trop courte (min 10 caractères)")
    .max(2000)
    .transform((v) => sanitizePlainText(v, 2000)),
  reason: z.string().max(64).optional(),
  photos: z.array(z.string().url().max(800)).max(5).optional(),
  photo_urls: z.array(z.string().url().max(800)).max(5).optional(),
})

export function parseLitigeBody(raw: unknown) {
  const parsed = litigeOpenSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || "Données litige invalides",
    }
  }
  const description = parsed.data.description
  const reason = parsed.data.reason
    ? normalizeDisputeReason(parsed.data.reason)
    : mapLitigeDescriptionToReason(description)
  const photos = parsed.data.photos || parsed.data.photo_urls || null
  // Only allow known reason ids (defense in depth)
  const allowed = new Set(DISPUTE_REASONS.map((r) => r.id))
  const safeReason = allowed.has(reason) ? reason : "other"
  return {
    ok: true as const,
    data: { description, reason: safeReason, photos },
  }
}
