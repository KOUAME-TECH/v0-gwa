/**
 * Copy studio audio (Mission D) — annonces SR + toasts.
 * Séparé du DSP pour tests unitaires sans Web Audio.
 */

export function voiceStudioStatusLabel(opts: {
  recording: boolean
  sttActive: boolean
}): string {
  if (!opts.recording) return "Studio audio inactif"
  const stt = opts.sttActive
    ? "transcription en cours"
    : "sans transcription"
  return `Studio audio : réduction de bruit active, ${stt}`
}

export function voiceSttUnavailableToast(): string {
  return "Transcription indisponible sur cet appareil — le vocal sera envoyé sans texte."
}
