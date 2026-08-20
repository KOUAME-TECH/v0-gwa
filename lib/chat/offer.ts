/**
 * Offre de prix dans le chat (négociation commande).
 * Contenu JSON stocké dans messages.content avec message_type = "offer".
 */

export type OfferStatus = "pending" | "accepted" | "countered" | "declined"

export type PriceOfferPayload = {
  v: 1
  kind: "price_offer"
  amount: number
  currency: "XOF"
  productName?: string
  productId?: string
  /** Quantité négociée (optionnelle) — lie from-offer */
  quantity?: number
  status: OfferStatus
  note?: string
  /** Set only by server /api/offers/respond — never trust client. */
  accepted_by?: string
  accepted_at?: string
  accepted_via?: "api_offers_respond"
  declined_by?: string
  declined_at?: string
  declined_via?: "api_offers_respond"
}

export function buildOfferContent(input: {
  amount: number
  productName?: string
  productId?: string
  quantity?: number
  note?: string
  status?: OfferStatus
}): string {
  const amount = Math.round(Number(input.amount))
  if (!Number.isFinite(amount) || amount < 1) {
    throw new Error("Montant invalide")
  }
  const payload: PriceOfferPayload = {
    v: 1,
    kind: "price_offer",
    amount,
    currency: "XOF",
    status: input.status || "pending",
  }
  if (input.productName) payload.productName = input.productName
  if (input.productId) payload.productId = input.productId
  if (
    typeof input.quantity === "number" &&
    Number.isFinite(input.quantity) &&
    input.quantity >= 1
  ) {
    payload.quantity = Math.min(999_999, Math.round(input.quantity))
  }
  if (input.note) payload.note = input.note
  return JSON.stringify(payload)
}

export function parseOfferContent(content: string): PriceOfferPayload | null {
  try {
    const raw = JSON.parse(content)
    if (
      raw &&
      raw.v === 1 &&
      raw.kind === "price_offer" &&
      typeof raw.amount === "number"
    ) {
      return raw as PriceOfferPayload
    }
  } catch {
    /* not JSON */
  }
  return null
}

export function formatOfferAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount))
}
