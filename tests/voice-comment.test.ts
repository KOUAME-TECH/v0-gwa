import { describe, it, expect } from "vitest"
import {
  resolveCommentMediaType,
  VOICE_COMMENT_PLACEHOLDER,
} from "@/lib/comments/voice-comment"
import { resolveListenMode } from "@/components/media/clickable-listen-text"

describe("resolveCommentMediaType", () => {
  it("texte seul → text", () => {
    expect(resolveCommentMediaType({ hasText: true, hasAudio: false })).toBe("text")
  })

  it("voix seule → voice", () => {
    expect(resolveCommentMediaType({ hasText: false, hasAudio: true })).toBe("voice")
  })

  it("texte + voix → text_voice", () => {
    expect(resolveCommentMediaType({ hasText: true, hasAudio: true })).toBe("text_voice")
  })
})

describe("resolveListenMode (tap pour écouter)", () => {
  it("audio_url prioritaire", () => {
    expect(resolveListenMode("Bonjour", "https://x/a.mp3")).toBe("audio")
  })

  it("texte sans audio → tts", () => {
    expect(resolveListenMode("Bonjour", null)).toBe("tts")
  })

  it("fallbackLabel sans texte → tts", () => {
    expect(resolveListenMode("", null, "Produit")).toBe("tts")
  })

  it("rien → none", () => {
    expect(resolveListenMode("", null)).toBe("none")
  })
})

describe("VOICE_COMMENT_PLACEHOLDER", () => {
  it("libellé onde sans « appuyez pour… »", () => {
    expect(VOICE_COMMENT_PLACEHOLDER).toBe("Note vocale")
    expect(VOICE_COMMENT_PLACEHOLDER).not.toMatch(/appuyez/i)
  })
})
