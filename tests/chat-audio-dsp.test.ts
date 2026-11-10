import { describe, expect, it } from "vitest"
import { voiceCaptureConstraints } from "@/lib/chat/audio-dsp"

describe("audio DSP constraints", () => {
  it("active AEC + NS + AGC mono", () => {
    const c = voiceCaptureConstraints()
    expect(c.audio).toBeTruthy()
    if (typeof c.audio === "object" && c.audio) {
      expect(c.audio.echoCancellation).toBe(true)
      expect(c.audio.noiseSuppression).toBe(true)
      expect(c.audio.autoGainControl).toBe(true)
      expect(c.audio.channelCount).toBe(1)
    }
  })
})
