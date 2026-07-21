import type { SCGDimensions } from "@/lib/scg/engine"

export type CoachAction = {
  dim: keyof SCGDimensions
  title: string
  how: string
  href: string
}

const COACH_MAP: Record<keyof SCGDimensions, Omit<CoachAction, "dim">> = {
  fiabilite: {
    title: "Honorer tes prochaines livraisons",
    how: "Confirme et livre à l’heure — chaque commande réussie monte ta fiabilité.",
    href: "/dashboard/commandes",
  },
  qualite: {
    title: "Soigner la qualité perçue",
    how: "Photos nettes, description honnête, réponse aux avis — moins de litiges.",
    href: "/dashboard/products",
  },
  engagement: {
    title: "Rester actif sur GWA",
    how: "Publie régulièrement et réponds aux messages acheteurs.",
    href: "/publier",
  },
  volumes: {
    title: "Augmenter un peu les volumes",
    how: "Ajoute une offre claire (prix + quantité) pour plus de transactions.",
    href: "/dashboard/products/new",
  },
  stabilite: {
    title: "Stabiliser ton approvisionnement",
    how: "Évite les ruptures : mets à jour le stock avant de publier.",
    href: "/dashboard/products",
  },
}

export type CoachBand = "low" | "mid" | "high"

/** Bande pédagogique selon score global (0–1000 typique SCG). */
export function coachBand(score: number): CoachBand {
  if (score < 400) return "low"
  if (score < 700) return "mid"
  return "high"
}

export function coachIntro(score: number): string {
  const band = coachBand(score)
  if (band === "low") {
    return `Ton score est ${score}. On part de bas, c’est normal — trois gestes concrets pour remonter.`
  }
  if (band === "mid") {
    return `Ton score est ${score} — déjà solide. Trois actions pour passer au niveau bancable.`
  }
  return `Ton score est ${score} — excellent. Trois gestes pour le garder stable.`
}

/** Jusqu’à 3 actions sur les dimensions les plus faibles (ton coach, pas jugement). */
export function getCoachActions(dims: SCGDimensions, limit = 3): CoachAction[] {
  return (Object.entries(dims) as [keyof SCGDimensions, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, Math.max(1, Math.min(limit, 5)))
    .map(([dim]) => ({ dim, ...COACH_MAP[dim] }))
}

export function buildCoachSpeech(score: number, actions: CoachAction[]): string {
  const n = actions.length
  const parts = [
    coachIntro(score),
    n === 1
      ? "Voici une action simple :"
      : `Voici ${n} actions simples :`,
    ...actions.map((a, i) => `${i + 1}. ${a.title}. ${a.how}`),
  ]
  return parts.join(" ")
}
