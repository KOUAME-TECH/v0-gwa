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

/** 2 actions concrètes sur les dimensions les plus faibles (ton coach, pas jugement). */
export function getCoachActions(dims: SCGDimensions): CoachAction[] {
  return (Object.entries(dims) as [keyof SCGDimensions, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([dim]) => ({ dim, ...COACH_MAP[dim] }))
}

export function buildCoachSpeech(score: number, actions: CoachAction[]): string {
  const parts = [
    `Ton score est ${score}. C’est un bon point de départ.`,
    "Pour l’améliorer, voici deux actions simples :",
    ...actions.map((a, i) => `${i + 1}. ${a.title}. ${a.how}`),
  ]
  return parts.join(" ")
}
