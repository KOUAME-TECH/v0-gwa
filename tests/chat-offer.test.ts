import { describe, it, expect } from "vitest"
import {
  buildOfferContent,
  parseOfferContent,
  formatOfferAmount,
} from "@/lib/chat/offer"
import { buildMessagePayload, InvalidMessageError } from "@/lib/chat/message"
import {
  areBothParticipantsConfirmed,
  buildAgreementConfirmationContent,
  buildAgreementContent,
  findConfirmedAgreement,
  parseAgreementContent,
} from "@/lib/chat/agreement"

describe("price offer chat", () => {
  it("serialise et parse une offre", () => {
    const raw = buildOfferContent({
      amount: 15000,
      quantity: 3,
      unit: "sacs",
      sellerId: "seller-1",
      productName: "Cacao",
      deliveryPlace: "Abidjan",
      deliveryDate: "2026-11-10",
      conditions: "Livraison le matin",
      note: "2 sacs",
    })
    const parsed = parseOfferContent(raw)
    expect(parsed?.amount).toBe(15000)
    expect(parsed?.quantity).toBe(3)
    expect(parsed?.deliveryPlace).toBe("Abidjan")
    expect(parsed?.deliveryDate).toBe("2026-11-10")
    expect(parsed?.sellerId).toBe("seller-1")
    expect(parsed?.productName).toBe("Cacao")
    expect(parsed?.status).toBe("pending")
    expect(formatOfferAmount(15000)).toMatch(/15/)
  })

  describe("chat agreement", () => {
    const agreement = {
      offerMessageId: "offer-1",
      productName: "Cacao",
      quantity: 3,
      unit: "sacs",
      unitPrice: 15000,
      deliveryPlace: "Abidjan",
      deliveryDate: "2026-11-10",
      conditions: "Livraison le matin",
      buyerId: "buyer-1",
      buyerName: "Acheteur",
      sellerId: "seller-1",
      sellerName: "Vendeur",
      confirmedBy: ["buyer-1", "seller-1"],
      createdAt: "2026-10-29T10:00:00.000Z",
    }

    it("calculates and parses a mutually confirmed agreement", () => {
      const parsed = parseAgreementContent(buildAgreementContent(agreement))
      expect(parsed?.total).toBe(45000)
      expect(parsed?.confirmedBy).toEqual(["buyer-1", "seller-1"])
    })

    it("requires two distinct confirmations", () => {
      expect(() =>
        buildAgreementContent({ ...agreement, confirmedBy: ["buyer-1", "buyer-1"] }),
      ).toThrow("Les deux participants doivent confirmer")
      const confirmation = buildAgreementConfirmationContent("offer-1")
      expect(
        areBothParticipantsConfirmed("offer-1", ["buyer-1", "seller-1"], [
          { sender_id: "buyer-1", content: confirmation },
          { sender_id: "buyer-1", content: confirmation },
        ]),
      ).toBe(false)
    })

    it("confirms agreement only after both conversation participants respond", () => {
      const confirmation = buildAgreementConfirmationContent("offer-1")
      expect(
        areBothParticipantsConfirmed("offer-1", ["buyer-1", "seller-1"], [
          { sender_id: "buyer-1", content: confirmation },
          { sender_id: "seller-1", content: confirmation },
        ]),
      ).toBe(true)
    })

    it("accepts only a document matching the accepted offer and both confirmations", () => {
      const offerContent = buildOfferContent({
        amount: 15000,
        quantity: 3,
        unit: "sacs",
        sellerId: "seller-1",
        productName: "Cacao",
        deliveryPlace: "Abidjan",
        deliveryDate: "2026-11-10",
        conditions: "Livraison le matin",
        status: "accepted",
      })
      const confirmation = buildAgreementConfirmationContent("offer-1")
      const acceptedMessages = [
        { id: "offer-1", sender_id: "buyer-1", content: offerContent, message_type: "offer" },
        { sender_id: "buyer-1", content: confirmation },
        { sender_id: "seller-1", content: confirmation },
        { sender_id: "buyer-1", content: buildAgreementContent(agreement) },
      ]

      expect(findConfirmedAgreement("offer-1", ["buyer-1", "seller-1"], acceptedMessages)?.total)
        .toBe(45000)
      expect(
        findConfirmedAgreement("offer-1", ["buyer-1", "seller-1"], [
          ...acceptedMessages.slice(0, 3),
          { sender_id: "buyer-1", content: buildAgreementContent({ ...agreement, unitPrice: 1 }) },
        ]),
      ).toBeNull()
    })
  })

  it("buildMessagePayload accepte type offer", () => {
    const content = buildOfferContent({ amount: 5000 })
    const p = buildMessagePayload({
      conversationId: "c1",
      senderId: "u1",
      content,
      type: "offer",
    })
    expect(p.message_type).toBe("offer")
  })

  it("refuse offre invalide", () => {
    expect(() =>
      buildMessagePayload({
        conversationId: "c1",
        senderId: "u1",
        content: "{bad}",
        type: "offer",
      }),
    ).toThrow(InvalidMessageError)
  })
})
