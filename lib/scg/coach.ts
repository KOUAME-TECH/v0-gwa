import type { SCGDimensions } from "@/lib/scg/engine"

export type CoachAction = {
  dim: keyof SCGDimensions
  title: string
  how: string
  href: string
}

const COACH_MAP: Record<keyof SCGDimensions, Omit<CoachAction, "dim">> = {
  character: {
    title: "Renforcer la confiance",
    how: "Fais vérifier ton identité, livre à la date promise et réponds vite aux messages.",
    href: "/profil",
  },
  capacity: {
    title: "Vendre un peu chaque mois",
    how: "Des ventes livrées régulières, à plusieurs acheteurs, prouvent ta capacité à rembourser.",
    href: "/dashboard/products/new",
  },
  capital: {
    title: "Montrer ce que tu as construit",
    how: "Publie ton stock avec prix et quantité, renseigne ta surface et ton matériel.",
    href: "/dashboard/products",
  },
  collateral: {
    title: "Sécuriser tes ventes",
    how: "Fais payer via le séquestre GWA, rejoins ta coopérative et géolocalise ton champ.",
    href: "/cooperatives",
  },
  conditions: {
    title: "Compléter ton contexte",
    how: "Indique tes filières, ta zone de production et aligne tes prix sur la référence.",
    href: "/profil",
  },
}

export type CoachBand = "low" | "mid" | "high"

/** Bande pédagogique selon score global (échelle SCG 0–1000). */
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
