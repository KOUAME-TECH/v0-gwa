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
  status: OfferStatus
  note?: string
}

export function buildOfferContent(input: {
  amount: number
  productName?: string
  productId?: string
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
