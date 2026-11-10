import { describe, expect, it } from "vitest"
import { shortCorrelationId, trackChatMetric } from "@/lib/chat/observability"

describe("observabilité chat", () => {
  it("correlation id stable et court", () => {
    expect(shortCorrelationId("abc")).toBe(shortCorrelationId("abc"))
    expect(shortCorrelationId("abc")).not.toBe(shortCorrelationId("abd"))
    expect(shortCorrelationId("x").length).toBe(8)
  })

  it("trackChatMetric n’envoie pas de contenu (no throw)", () => {
    expect(() =>
      trackChatMetric("chat.media.upload", { ok: true, kind: "image", ms: 12 }),
    ).not.toThrow()
  })
})
