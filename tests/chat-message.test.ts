import { describe, it, expect } from "vitest"
import { buildMessagePayload, InvalidMessageError } from "@/lib/chat/message"

describe("payload message chat (P10)", () => {
  it("construit un message texte valide", () => {
    const p = buildMessagePayload({
      conversationId: "c1",
      senderId: "u1",
      content: "  Bonjour  ",
    })
    expect(p).toEqual({
      conversation_id: "c1",
      sender_id: "u1",
      content: "Bonjour",
      message_type: "text",
    })
  })

  it("inclut reply_to_id quand fourni", () => {
    const p = buildMessagePayload({
      conversationId: "c1",
      senderId: "u1",
      content: "ok",
      replyToId: "m9",
    })
    expect(p.reply_to_id).toBe("m9")
  })

  it("un message média porte media_url et son type", () => {
    const p = buildMessagePayload({
      conversationId: "c1",
      senderId: "u1",
      content: "Message vocal (0:03)",
      type: "voice",
      mediaUrl: "https://x/voice.webm",
    })
    expect(p.message_type).toBe("voice")
    expect(p.media_url).toBe("https://x/voice.webm")
  })

  it("refuse un texte vide et un média sans url", () => {
    expect(() => buildMessagePayload({ conversationId: "c1", senderId: "u1", content: "   " })).toThrow(
      InvalidMessageError,
    )
    expect(() =>
      buildMessagePayload({ conversationId: "c1", senderId: "u1", content: "x", type: "image" }),
    ).toThrow(/média/i)
  })

  it("refuse conversation ou expéditeur manquant", () => {
    expect(() => buildMessagePayload({ conversationId: "", senderId: "u1", content: "x" })).toThrow()
    expect(() => buildMessagePayload({ conversationId: "c1", senderId: "", content: "x" })).toThrow()
  })
})
