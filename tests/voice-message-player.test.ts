import { describe, expect, it } from "vitest"
import { VOICE_PLAYBACK_SPEEDS } from "@/components/chat/voice-message-player"

describe("VoiceMessagePlayer speeds", () => {
  it("expose 0.5 / 1 / 1.5 / 2× comme WhatsApp", () => {
    expect([...VOICE_PLAYBACK_SPEEDS]).toEqual([0.5, 1, 1.5, 2])
  })
})
