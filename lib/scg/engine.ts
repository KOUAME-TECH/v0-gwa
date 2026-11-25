import { SCG_BANCABLE_MIN } from "@/lib/scg/scale"
import {
  computeFiveC,
  PILLAR_META,
  SCG_MODEL_VERSION,
  type FiveCResult,
  type PillarKey,
  type ScgExplainItem,
  type ScgInputs,
} from "@/lib/scg/five-c"

/**
 * GWA — Score de Confiance GWA (SCG), modèle bancaire des 5C (v « 5c-v1 »).
 * Caractère 25 % · Capacité 25 % · Capital 15 % · Garanties (collatéral) 20 % · Conditions 15 %.
 * Échelle du score global : 0 à 1000 (cf. lib/scg/scale.ts). Méthode : docs/scg-5c.md.
 * Calcul côté serveur uniquement (données : public.scg_5c_inputs, migration 085).
 */

export type { ScgInputs, PillarKey, ScgExplainItem } from "@/lib/scg/five-c"

/** Les 5 piliers, chacun sur 100. */
export type SCGDimensions = Record<PillarKey, number>

export interface SCGExplain {
  model_version: string
  top_up: ScgExplainItem[]
  top_down: ScgExplainItem[]
  caps: FiveCResult["caps"]
  flags: string[]
  factors: FiveCResult["factors"]
}

export interface SCGResult {
  user_id: string
  score_total: number // 0-1000
  badge: string
  badge_label: string
  dimensions: SCGDimensions
  recommandation: string
  bancable: boolean
  calculated_at: string
  explain?: SCGExplain
}

export function getBadge(score: number): { id: string; label: string } {
  if (score >= 800) return { id: "excellence", label: "Excellence" }
  if (score >= 600) return { id: "confirme", label: "Confirmé" }
  if (score >= 400) return { id: "actif", label: "Actif" }
  if (score >= 200) return { id: "debutant", label: "Débutant" }
  return { id: "insuffisant", label: "Insuffisant" }
}

export const DIMENSION_META: { key: PillarKey; label: string; question: string; weight: number }[] = PILLAR_META

const LABEL: Record<PillarKey, string> = Object.fromEntries(PILLAR_META.map((m) => [m.key, m.label])) as Record<
  PillarKey,
  string
>

export function getRecommandation(score: number, dims: SCGDimensions, bancable = score >= SCG_BANCABLE_MIN): string {
  const faibles = (Object.entries(dims) as [PillarKey, number][])
    .filter(([, v]) => v < 40)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => LABEL[k])
  if (bancable && score >= 700) {
    return "Profil bancable solide — dossier présentable à un partenaire financier."
  }
  if (bancable) {
    const recs = faibles.length ? `Renforcer : ${faibles.slice(0, 2).join(", ")}.` : "Garder la régularité des ventes."
    return `Profil bancable — ${recs}`
  }
  if (score >= 300) {
    const focus = faibles.length ? faibles.slice(0, 2).join(", ") : "la vérification d’identité et la régularité"
    return `Profil en développement — Priorité : ${focus}.`
  }
  return "Profil en construction — Vérifie ton identité et réussis tes premières ventes livrées sur GWA."
}

export function calculateSCG(inputs: ScgInputs, now: Date = new Date()): SCGResult {
  const r = computeFiveC(inputs, now)
  const badge = getBadge(r.score_total)
  return {
    user_id: inputs.user_id,
    score_total: r.score_total,
    badge: badge.id,
    badge_label: badge.label,
    dimensions: r.pillars,
    recommandation: getRecommandation(r.score_total, r.pillars, r.bancable),
    bancable: r.bancable,
    calculated_at: now.toISOString(),
    explain: {
      model_version: SCG_MODEL_VERSION,
      top_up: r.top_up,
      top_down: r.top_down,
      caps: r.caps,
      flags: r.flags,
      factors: r.factors,
    },
  }
}
