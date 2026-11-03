import { describe, expect, it } from "vitest"
import {
  voiceMeterBarHeights,
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

  it("vu-mètre DSP suit le niveau RMS", () => {
    const quiet = voiceMeterBarHeights(0, 8, 3, 18)
    const loud = voiceMeterBarHeights(1, 8, 3, 18)
    expect(quiet).toHaveLength(8)
    expect(quiet.every((h) => h === 3)).toBe(true)
    expect(Math.max(...loud)).toBeGreaterThan(Math.max(...quiet))
    expect(Math.max(...loud)).toBeLessThanOrEqual(18)
  })
})
