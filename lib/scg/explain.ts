/**
 * Score de Confiance GWA (SCG) expliqué simplement (profil, Lot D).
 * Échelle 0 à 1000 ; paliers alignés sur les badges du moteur (800 / 600 / 400).
 */
import { clampScg, SCG_MAX } from "@/lib/scg/scale"

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
  `Ton Score de Confiance va de 0 à ${SCG_MAX}. Plus il est haut, plus les acheteurs voient que tu es sérieux. Il monte quand tu livres à temps, quand tes clients sont satisfaits et quand ton profil est complet et vérifié. C’est un indicateur GWA, pas une note bancaire.`

export const SCG_TIPS = [
  "Livre à la date promise",
  "Fais vérifier ton identité",
  "Réponds vite aux messages",
] as const
