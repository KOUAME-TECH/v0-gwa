/**
 * TTS navigateur (speechSynthesis) — lecture conseil IA / accessibilité.
 */

export function isBrowserTtsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export function speakFrench(text: string): { ok: boolean; reason?: string } {
  if (!isBrowserTtsAvailable()) {
    return { ok: false, reason: "tts_unavailable" }
  }
  const clean = (text || "").replace(/\[Conseil IA\]/gi, "").trim()
  if (!clean) return { ok: false, reason: "empty" }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean.slice(0, 600))
    u.lang = "fr-FR"
    u.rate = 1
    window.speechSynthesis.speak(u)
    return { ok: true }
  } catch {
    return { ok: false, reason: "speak_failed" }
  }
}

export function stopSpeaking(): void {
  if (isBrowserTtsAvailable()) window.speechSynthesis.cancel()
}
