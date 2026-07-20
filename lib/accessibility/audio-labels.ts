/** Libellés accessibilité audio — WCAG 2.2 / EN 301 549 (lecteurs d'écran). */

export const AUDIO_LABELS = {
  playVoice: "Écouter la note vocale",
  playText: "Écouter le texte à voix haute",
  stop: "Arrêter la lecture",
  voiceNote: "Note vocale",
  voiceProduct: "Écouter la description du produit",
  shopTour: "Parcours vocal du marketplace",
  shopTourStop: "Arrêter le parcours vocal",
  recording: "Enregistrement en cours",
} as const

/** Texte visible minimal pour contenu vocal sans légende (pas de « appuyez pour… »). */
export const VOICE_VISIBLE_LABEL = "Note vocale"
