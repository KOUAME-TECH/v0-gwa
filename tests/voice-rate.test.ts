import { describe, expect, it } from "vitest"
import { isVoicePace, voiceRate } from "@/lib/media/voice-rate"

describe("voiceRate", () => {
  it("donne trois débits distincts", () => {
    expect(voiceRate("lent")).toBeLessThan(voiceRate("normal"))
    expect(voiceRate("normal")).toBeLessThan(voiceRate("rapide"))
    expect(isVoicePace("rapide")).toBe(true)
    expect(isVoicePace("turbo")).toBe(false)
  })
})
