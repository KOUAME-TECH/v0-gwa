import { describe, expect, it } from "vitest"
import { pickFrenchVoice } from "@/lib/chat/tts"

function voice(
  lang: string,
  name: string,
  localService = true,
): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService,
    name,
    voiceURI: name,
  } as SpeechSynthesisVoice
}

describe("pickFrenchVoice", () => {
  it("préfère fr-FR Google", () => {
    const picked = pickFrenchVoice([
      voice("en-US", "Google US English"),
      voice("fr-FR", "Google français"),
      voice("fr-CA", "Amélie"),
    ])
    expect(picked?.name).toBe("Google français")
  })

  it("accepte fr-* si pas de fr-FR", () => {
    const picked = pickFrenchVoice([
      voice("en-GB", "Daniel"),
      voice("fr-CA", "Amélie"),
    ])
    expect(picked?.lang.toLowerCase().startsWith("fr")).toBe(true)
  })

  it("retourne null sans voix FR", () => {
    expect(pickFrenchVoice([voice("en-US", "Samantha")])).toBeNull()
  })
})
