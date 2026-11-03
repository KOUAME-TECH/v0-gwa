/**
 * Transcription vocale côté client (Web Speech API) — Mission Audio.
 * Non bloquant : échec silencieux → pas de transcription.
 */

export const VOICE_TRANSCRIPT_MARKER = "[Transcription]"

export function formatVoiceMessageContent(
  duration: string,
  transcript?: string | null,
): string {
  const dur = (duration || "0:00").trim()
  const base = `Message vocal (${dur})`
  const t = (transcript || "").trim()
  if (!t) return base
  return `${base}\n${VOICE_TRANSCRIPT_MARKER}\n${t.slice(0, 500)}`
}

export function parseVoiceTranscript(content: string): string | null {
  if (!content) return null
  const idx = content.indexOf(VOICE_TRANSCRIPT_MARKER)
  if (idx < 0) return null
  const body = content.slice(idx + VOICE_TRANSCRIPT_MARKER.length).trim()
  return body || null
}

export function parseVoiceDuration(content: string): string {
  return content?.match(/\(([^)]+)\)/)?.[1] || "0:00"
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: ((ev: unknown) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isBrowserSttAvailable(): boolean {
  return !!getSpeechRecognitionCtor()
}

/**
 * Transcrit un Blob audio via reconnaissance « live » pendant l’enregistrement
 * n’est pas toujours possible ; on expose une API pour reconnaissance en parallèle
 * du MediaRecorder (même micro).
 */
export function startParallelStt(opts?: {
  lang?: string
  onPartial?: (text: string) => void
}): { stop: () => Promise<string>; available: boolean } {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    return {
      available: false,
      stop: async () => "",
    }
  }
  const rec = new Ctor()
  rec.lang = opts?.lang || "fr-FR"
  rec.continuous = true
  rec.interimResults = true
  let finalText = ""
  rec.onresult = (ev) => {
    let interim = ""
    for (let i = 0; i < ev.results.length; i++) {
      const piece = ev.results[i]?.[0]?.transcript || ""
      // SpeechRecognitionResultList n’expose pas toujours isFinal typé — on accumule
      interim += piece + " "
    }
    const cleaned = interim.replace(/\s+/g, " ").trim()
    if (cleaned) {
      finalText = cleaned
      opts?.onPartial?.(cleaned)
    }
  }
  rec.onerror = () => {
    /* ignore — fallback sans transcription */
  }
  try {
    rec.start()
  } catch {
    return { available: false, stop: async () => "" }
  }
  return {
    available: true,
    stop: () =>
      new Promise((resolve) => {
        rec.onend = () => resolve(finalText.trim())
        try {
          rec.stop()
        } catch {
          resolve(finalText.trim())
        }
        setTimeout(() => resolve(finalText.trim()), 800)
      }),
  }
}
