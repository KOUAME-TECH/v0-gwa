import { describe, it, expect } from "vitest"
import {
  buildOfferContent,
  parseOfferContent,
  formatOfferAmount,
} from "@/lib/chat/offer"
import { buildMessagePayload, InvalidMessageError } from "@/lib/chat/message"

describe("price offer chat", () => {
  it("serialise et parse une offre", () => {
    const raw = buildOfferContent({
      amount: 15000,
      productName: "Cacao",
      note: "2 sacs",
    })
    const parsed = parseOfferContent(raw)
    expect(parsed?.amount).toBe(15000)
    expect(parsed?.productName).toBe("Cacao")
    expect(parsed?.status).toBe("pending")
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
})
