import { NextResponse } from "next/server"
import { decidePayoutWebhook, payoutWebhookSchema } from "@/lib/billing/payout-webhook"

/**
 * Squelette mars 2027. Aucun prestataire réel n'écrit en base.
 * MOCK montre seulement le statut qui sera appliqué le jour de l'automatisation.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  const parsed = payoutWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Événement de versement invalide" }, { status: 400 })
  }

  const decision = decidePayoutWebhook(parsed.data)
  if (parsed.data.provider !== "MOCK") {
    return NextResponse.json(
      {
        error: "Webhook de versement inactif",
        active: false,
        provider: parsed.data.provider,
      },
      { status: 503 },
    )
  }

  return NextResponse.json({
    received: true,
    active: decision.active,
    preview: {
      reference: decision.reference,
      provider: decision.provider,
      nextStatus: decision.nextStatus,
    },
  })
}
