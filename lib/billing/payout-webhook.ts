import { z } from "zod"
import type { PaymentProvider } from "@/lib/billing/types"

export const payoutWebhookSchema = z.object({
  provider: z.enum(["GENIUSPAY", "PAWAPAY", "MOOV_API", "MOCK"]),
  type: z.enum(["transfer.success", "transfer.failed"]),
  reference: z.string().trim().min(1).max(128),
})

export type PayoutWebhookEvent = z.infer<typeof payoutWebhookSchema>

export type PayoutWebhookDecision = {
  active: boolean
  reference: string
  provider: PaymentProvider
  nextStatus: "completed" | "failed" | null
}

/** Décision pure. La route MOCK ne l'écrit pas encore en base. */
export function decidePayoutWebhook(event: PayoutWebhookEvent): PayoutWebhookDecision {
  if (event.provider !== "MOCK") {
    return {
      active: false,
      reference: event.reference,
      provider: event.provider,
      nextStatus: null,
    }
  }
  return {
    active: false,
    reference: event.reference,
    provider: event.provider,
    nextStatus: event.type === "transfer.success" ? "completed" : "failed",
  }
}
