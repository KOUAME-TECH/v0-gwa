/**
 * Score de Confiance GWA (SCG) expliqué simplement (profil, Lot D).
 * Échelle 0 à 1000 ; paliers alignés sur les badges du moteur (800 / 600 / 400).
 */
import { clampScg, SCG_MAX } from "@/lib/scg/scale"
import type { PillarKey } from "@/lib/scg/five-c"

export type ScgLevel = { label: string; tone: "low" | "mid" | "good" | "top"; sentence: string }

export function scgLevel(score: number | null | undefined): ScgLevel | null {
  if (score == null || !Number.isFinite(score)) return null
  const s = clampScg(score)
  if (s >= 800) return { label: "Excellent", tone: "top", sentence: "Les acheteurs et les partenaires financiers te font confiance." }
  if (s >= 600) return { label: "Bon", tone: "good", sentence: "Tu es fiable. Continue à livrer à temps pour passer à Excellent." }
  if (s >= 400) return { label: "En progression", tone: "mid", sentence: "Ton score monte avec chaque vente bien livrée." }
  return { label: "Débutant", tone: "low", sentence: "Complète ton profil et réussis tes premières ventes pour monter." }
}

export const SCG_EXPLANATION =
  `Ton Score de Confiance va de 0 à ${SCG_MAX}. Il suit la méthode des banques, les « 5C » : Caractère (confiance), Capacité (ventes régulières), Capital (ce que tu as construit), Garanties (séquestre, coopérative, parcelles) et Conditions (filière, zone, saison). Il monte quand tu livres à temps, quand ton identité est vérifiée et quand tes ventes passent par GWA. C’est un indicateur GWA, pas une note bancaire ni une décision de crédit.`

const PILLAR_SENTENCES: Record<PillarKey, [string, string, string]> = {
  character: [
    "On ne te connaît pas encore assez : vérifie ton identité et tiens tes engagements.",
    "La confiance s’installe : avis, livraisons à temps et réponses rapides la renforcent.",
    "On peut te faire confiance : identité vérifiée et engagements tenus.",
  ],
  capacity: [
    "Peu de ventes prouvées sur GWA pour l’instant.",
    "Tu vends, mais pas encore chaque mois ni à assez d’acheteurs.",
    "Tes ventes sont régulières : ta capacité à rembourser est prouvée.",
  ],
  capital: [
    "Ce que tu as construit n’est pas encore visible sur GWA.",
    "Ton activité commence à se voir : revenus, stock et surface.",
    "Ton activité a une vraie assise : revenus, stock et outils.",
  ],
  collateral: [
    "Peu de garanties : séquestre, coopérative ou parcelle géolocalisée manquent.",
    "Quelques garanties existent ; ta coopérative ou tes ventes en séquestre peuvent en ajouter.",
    "Tes garanties sont solides : séquestre, coopérative et parcelles.",
  ],
  conditions: [
    "Ton contexte est peu connu ou plus risqué (filière, zone, prix).",
    "Contexte moyen : filière, saison et zone sans risque particulier.",
    "Contexte favorable : filière porteuse, zone couverte et prix alignés.",
  ],
}

/** Phrase simple pour un pilier 5C selon son niveau (0–100). */
export function pillarSentence(key: PillarKey, value: number): string {
  const [low, mid, high] = PILLAR_SENTENCES[key]
  return value >= 70 ? high : value >= 40 ? mid : low
}

export const SCG_TIPS = [
  "Livre à la date promise",
  "Fais vérifier ton identité",
  "Réponds vite aux messages",
] as const
