import { describe, expect, it } from "vitest"
import {
  voiceStudioStatusLabel,
  voiceSttUnavailableToast,
} from "@/lib/chat/voice-studio-copy"

describe("voice studio copy", () => {
  it("annonce studio + STT", () => {
    expect(voiceStudioStatusLabel({ recording: true, sttActive: true })).toMatch(
      /réduction de bruit/i,
    )
    expect(voiceStudioStatusLabel({ recording: true, sttActive: true })).toMatch(
      /transcription en cours/i,
    )
    expect(voiceStudioStatusLabel({ recording: true, sttActive: false })).toMatch(
      /sans transcription/i,
    )
    expect(voiceStudioStatusLabel({ recording: false, sttActive: false })).toMatch(
      /inactif/i,
    )
  })

  it("toast STT indisponible clair", () => {
    expect(voiceSttUnavailableToast()).toMatch(/Transcription indisponible/i)
  })
})
