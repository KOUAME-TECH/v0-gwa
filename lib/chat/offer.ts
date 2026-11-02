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
  /** Quantité proposée (unités du produit) */
  quantity?: number
  /** Lieu de livraison / retrait */
  location?: string
  /** Délai souhaité (texte libre, ex. « demain », « 3 jours ») */
  deliveryBy?: string
}

export function buildOfferContent(input: {
  amount: number
  productName?: string
  productId?: string
  note?: string
  status?: OfferStatus
  quantity?: number
  location?: string
  deliveryBy?: string
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
  const qty = Math.round(Number(input.quantity))
  if (Number.isFinite(qty) && qty >= 1) payload.quantity = qty
  if (input.location?.trim()) payload.location = input.location.trim().slice(0, 120)
  if (input.deliveryBy?.trim()) {
    payload.deliveryBy = input.deliveryBy.trim().slice(0, 80)
  }
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
