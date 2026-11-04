export const VOICE_PACES = ["lent", "normal", "rapide"] as const
export type VoicePace = (typeof VOICE_PACES)[number]

const RATES: Record<VoicePace, number> = {
  lent: 0.82,
  normal: 0.94,
  rapide: 1.12,
}

const KEY = "gwa_voice_pace"

export function isVoicePace(value: string | null | undefined): value is VoicePace {
  return value === "lent" || value === "normal" || value === "rapide"
}

export function readVoicePace(): VoicePace {
  if (typeof localStorage === "undefined") return "normal"
  try {
    const raw = localStorage.getItem(KEY)
    return isVoicePace(raw) ? raw : "normal"
  } catch {
    return "normal"
  }
}

export function writeVoicePace(pace: VoicePace): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(KEY, pace)
  } catch {
    /* ignore */
  }
}

export function voiceRate(pace: VoicePace = readVoicePace()): number {
  return RATES[pace]
}
