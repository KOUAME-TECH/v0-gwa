import { parseOfferContent } from "@/lib/chat/offer"

export interface AgreementTerms {
  v: 1
  kind: "gwa_agreement"
  offerMessageId: string
  productId?: string
  productName: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
  deliveryPlace: string
  deliveryDate: string
  conditions: string
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  confirmedBy: string[]
  createdAt: string
}

interface AgreementConfirmation {
  v: 1
  kind: "gwa_agreement_confirmation"
  offerMessageId: string
}

export function buildAgreementConfirmationContent(offerMessageId: string): string {
  if (!offerMessageId.trim()) throw new Error("Offre requise")
  const payload: AgreementConfirmation = {
    v: 1,
    kind: "gwa_agreement_confirmation",
    offerMessageId: offerMessageId.trim(),
  }
  return JSON.stringify(payload)
}

export function parseAgreementConfirmation(content: string): AgreementConfirmation | null {
  try {
    const value = JSON.parse(content)
    if (
      value?.v === 1 &&
      value?.kind === "gwa_agreement_confirmation" &&
      typeof value.offerMessageId === "string" &&
      value.offerMessageId.length > 0
    ) {
      return value as AgreementConfirmation
    }
  } catch {
    return null
  }
  return null
}

export function buildAgreementContent(
  input: Omit<AgreementTerms, "v" | "kind" | "total">,
): string {
  const productName = input.productName.trim()
  const quantity = Math.floor(Number(input.quantity))
  const unitPrice = Math.round(Number(input.unitPrice))
  const total = quantity * unitPrice
  if (!input.offerMessageId.trim() || !productName) throw new Error("Produit et offre requis")
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Quantité invalide")
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || !Number.isSafeInteger(total)) {
    throw new Error("Prix invalide")
  }
  if (!input.buyerId.trim() || !input.sellerId.trim() || input.buyerId === input.sellerId) {
    throw new Error("Participants invalides")
  }
  if (new Set(input.confirmedBy).size < 2) throw new Error("Les deux participants doivent confirmer")

  const payload: AgreementTerms = {
    ...input,
    v: 1,
    kind: "gwa_agreement",
    offerMessageId: input.offerMessageId.trim(),
    productName,
    quantity,
    unitPrice,
    total,
    deliveryPlace: input.deliveryPlace.trim(),
    deliveryDate: input.deliveryDate.trim(),
    conditions: input.conditions.trim(),
    buyerId: input.buyerId.trim(),
    buyerName: input.buyerName.trim(),
    sellerId: input.sellerId.trim(),
    sellerName: input.sellerName.trim(),
    confirmedBy: [...new Set(input.confirmedBy)],
  }
  return JSON.stringify(payload)
}

export function parseAgreementContent(content: string): AgreementTerms | null {
  try {
    const value = JSON.parse(content)
    if (
      value?.v !== 1 ||
      value?.kind !== "gwa_agreement" ||
      typeof value.offerMessageId !== "string" ||
      typeof value.productName !== "string" ||
      !Number.isSafeInteger(value.quantity) ||
      value.quantity < 1 ||
      (value.unit !== undefined && typeof value.unit !== "string") ||
      !Number.isSafeInteger(value.unitPrice) ||
      value.unitPrice < 1 ||
      !Number.isSafeInteger(value.total) ||
      value.total < 1 ||
      (value.productId !== undefined && typeof value.productId !== "string") ||
      typeof value.deliveryPlace !== "string" ||
      typeof value.deliveryDate !== "string" ||
      typeof value.conditions !== "string" ||
      typeof value.buyerId !== "string" ||
      typeof value.buyerName !== "string" ||
      typeof value.sellerId !== "string" ||
      typeof value.sellerName !== "string" ||
      !Array.isArray(value.confirmedBy) ||
      value.confirmedBy.length < 2 ||
      !value.confirmedBy.every((participantId: unknown) => typeof participantId === "string") ||
      typeof value.createdAt !== "string"
    ) {
      return null
    }
    return value as AgreementTerms
  } catch {
    return null
  }
}

export function areBothParticipantsConfirmed(
  offerMessageId: string,
  participantIds: [string, string],
  messages: Array<{ sender_id: string; content: string }>,
): boolean {
  const confirmations = new Set(
    messages
      .filter((message) => parseAgreementConfirmation(message.content)?.offerMessageId === offerMessageId)
      .map((message) => message.sender_id),
  )
  return participantIds.every((participantId) => confirmations.has(participantId))
}

export function findConfirmedAgreement(
  offerMessageId: string,
  participantIds: [string, string],
  messages: Array<{ id?: string; sender_id: string; content: string; message_type?: string }>,
): AgreementTerms | null {
  const offerMessage = messages.find((message) => message.id === offerMessageId)
  const offer = offerMessage ? parseOfferContent(offerMessage.content) : null
  if (!offer || offer.status !== "accepted" || !areBothParticipantsConfirmed(offerMessageId, participantIds, messages)) {
    return null
  }

  const participantSet = new Set(participantIds)
  const expectedQuantity = offer.quantity || 1
  const expectedConditions = offer.conditions || offer.note || "Aucune condition précisée"
  const expectedSellerId = offer.sellerId
  for (const message of messages) {
    const agreement = parseAgreementContent(message.content)
    if (!agreement || agreement.offerMessageId !== offerMessageId) continue
    const confirmedBy = new Set(agreement.confirmedBy)
    if (
      confirmedBy.size !== 2 ||
      !participantSet.has(agreement.buyerId) ||
      !participantSet.has(agreement.sellerId) ||
      agreement.buyerId === agreement.sellerId ||
      !participantIds.every((participantId) => confirmedBy.has(participantId)) ||
      agreement.productId !== offer.productId ||
      agreement.productName !== (offer.productName || "Produit convenu") ||
      agreement.quantity !== expectedQuantity ||
      agreement.unit !== offer.unit ||
      agreement.unitPrice !== offer.amount ||
      agreement.total !== offer.amount * expectedQuantity ||
      agreement.deliveryPlace !== (offer.deliveryPlace || "À convenir") ||
      agreement.deliveryDate !== (offer.deliveryDate || "À convenir") ||
      agreement.conditions !== expectedConditions ||
      (expectedSellerId && agreement.sellerId !== expectedSellerId) ||
      !agreement.buyerName.trim() ||
      !agreement.sellerName.trim() ||
      !Number.isFinite(Date.parse(agreement.createdAt))
    ) {
      continue
    }
    return agreement
  }
  return null
}
