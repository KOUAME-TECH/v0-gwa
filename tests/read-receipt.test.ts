import { describe, it, expect } from "vitest"
import { resolveReadReceipt } from "@/lib/chat/read-receipt"

describe("resolveReadReceipt (H3 honest ticks)", () => {
  it("pas de tick pour un message entrant", () => {
    expect(
      resolveReadReceipt({
        viewerId: "me",
        lastSenderId: "other",
        isRead: true,
      }),
    ).toBe("none")
  })

  it("envoyé (gris) si notre message non lu", () => {
    expect(
      resolveReadReceipt({
        viewerId: "me",
        lastSenderId: "me",
        isRead: false,
      }),
    ).toBe("sent")
  })

  it("lu (bleu) seulement si is_read=true et message nôtre", () => {
    expect(
      resolveReadReceipt({
        viewerId: "me",
        lastSenderId: "me",
        isRead: true,
      }),
    ).toBe("read")
  })

  it("aucun tick sans lastSenderId", () => {
    expect(resolveReadReceipt({ viewerId: "me" })).toBe("none")
  })
})
