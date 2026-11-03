/**
 * TTS navigateur (speechSynthesis) — lecture conseil IA / accessibilité.
 * Préfère une voix fr-FR quand disponible (Chrome/Android/Safari).
 */

export function isBrowserTtsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

/** Choisit la meilleure voix française disponible (cache léger). */
let cachedFrVoice: SpeechSynthesisVoice | null | undefined

export function pickFrenchVoice(
  voices?: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const list =
    voices ??
    (typeof window !== "undefined" && window.speechSynthesis
      ? window.speechSynthesis.getVoices()
      : [])
  if (!list.length) return null

  const scored = list
    .map((v) => {
      const lang = (v.lang || "").toLowerCase().replace("_", "-")
      const name = (v.name || "").toLowerCase()
      if (!lang.startsWith("fr")) return { v, score: 0 }
      let score = 10
      if (lang === "fr-fr") score += 40
      if (name.includes("google")) score += 20
      if (name.includes("thomas") || name.includes("amélie") || name.includes("amelie"))
        score += 10
      if (v.localService) score += 5
      return { v, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.v ?? null
}

function resolveFrenchVoice(): SpeechSynthesisVoice | null {
  if (cachedFrVoice !== undefined) return cachedFrVoice
  cachedFrVoice = pickFrenchVoice()
  return cachedFrVoice
}

/** Invalide le cache (après voiceschanged). */
export function resetTtsVoiceCache(): void {
  cachedFrVoice = undefined
}

export function speakFrench(text: string): { ok: boolean; reason?: string } {
  if (!isBrowserTtsAvailable()) {
    return { ok: false, reason: "tts_unavailable" }
  }
  const clean = (text || "").replace(/\[Conseil IA\]/gi, "").trim()
  if (!clean) return { ok: false, reason: "empty" }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean.slice(0, 800))
    u.lang = "fr-FR"
    u.rate = 1
    u.pitch = 1
    const voice = resolveFrenchVoice()
    if (voice) u.voice = voice
    // voiceschanged peut arriver après le 1er appel (Chrome)
    if (!voice && typeof window.speechSynthesis.addEventListener === "function") {
      const onVoices = () => {
        resetTtsVoiceCache()
        const v = resolveFrenchVoice()
        if (v) u.voice = v
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices)
      }
      window.speechSynthesis.addEventListener("voiceschanged", onVoices)
    }
    window.speechSynthesis.speak(u)
    return { ok: true }
  } catch {
    return { ok: false, reason: "speak_failed" }
  }
}

export function stopSpeaking(): void {
  if (isBrowserTtsAvailable()) window.speechSynthesis.cancel()
}
