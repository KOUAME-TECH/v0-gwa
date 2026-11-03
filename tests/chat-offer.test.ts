import { describe, it, expect } from "vitest"
import {
  buildOfferContent,
  parseOfferContent,
  formatOfferAmount,
  offerDeltaLabel,
} from "@/lib/chat/offer"
import { buildMessagePayload, InvalidMessageError } from "@/lib/chat/message"

describe("price offer chat", () => {
  it("serialise et parse une offre", () => {
    const raw = buildOfferContent({
      amount: 15000,
      productName: "Cacao",
      note: "2 sacs",
      quantity: 3,
      location: "Abidjan",
      deliveryBy: "3 jours",
    })
    const parsed = parseOfferContent(raw)
    expect(parsed?.amount).toBe(15000)
    expect(parsed?.productName).toBe("Cacao")
    expect(parsed?.status).toBe("pending")
    expect(parsed?.quantity).toBe(3)
    expect(parsed?.location).toBe("Abidjan")
    expect(parsed?.deliveryBy).toBe("3 jours")
    expect(formatOfferAmount(15000)).toMatch(/15/)
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

  it("libellé contre-offre vs catalogue", () => {
    expect(offerDeltaLabel(10000, 8500)).toMatch(/Contre-offre/i)
    expect(offerDeltaLabel(10000, 11000)).toMatch(/Surcote/i)
    expect(offerDeltaLabel(10000, 10000)).toBeNull()
    expect(offerDeltaLabel(null, 5000)).toBeNull()
  })
})
