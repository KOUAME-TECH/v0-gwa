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

/**
 * Hauteurs de barres du vu-mètre (px) à partir du niveau RMS DSP 0–1.
 * Remplace les sinusoïdes décoratives par une preuve visuelle studio.
 */
export function voiceMeterBarHeights(
  level: number,
  count = 40,
  minPx = 3,
  maxPx = 18,
): number[] {
  const l = Math.max(0, Math.min(1, Number(level) || 0))
  const span = Math.max(1, maxPx - minPx)
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    // Léger déphasage spatial pour lisibilité, amplitude = niveau réel
    const phase = 0.55 + 0.45 * Math.sin(i * 0.37)
    return Math.round(minPx + span * l * phase)
  })
}
