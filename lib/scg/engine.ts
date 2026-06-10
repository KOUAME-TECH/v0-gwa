/**
 * GWA — Score de Confiance GWA (SCG) v1.0
 * Port TypeScript de l'algorithme FastAPI (Ref: GWA-TECH-SCG-014)
 * Règles métier Phase 0 — pas de ML
 */

export interface ProducteurData {
  user_id: string
  // Dimension 1 — Fiabilité transactions (25%)
  commandes_total?: number
  commandes_honorees?: number
  delai_moyen_livraison_heures?: number
  commandes_annulees?: number
  // Dimension 2 — Qualité produit (20%)
  note_moyenne_acheteurs?: number // 0-5
  nb_evaluations?: number
  litiges_ouverts?: number
  litiges_resolus?: number
  certifications_count?: number
  // Dimension 3 — Engagement réseau (20%)
  jours_actif_plateforme?: number
  formations_suivies?: number
  cooperative_active?: boolean
  parrainage_count?: number
  // Dimension 4 — Historique volumes (20%)
  gmv_cumule_fcfa?: number
  mois_actif_consecutifs?: number
  variation_volume_pct?: number
  // Dimension 5 — Stabilité approvisionnement (15%)
  offres_publiees_total?: number
  regularite_publication_score?: number // 0-1
  ruptures_stock_count?: number
}

export interface SCGDimensions {
  fiabilite: number
  qualite: number
  engagement: number
  volumes: number
  stabilite: number
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
}

const POIDS = {
  fiabilite: 0.25,
  qualite: 0.2,
  engagement: 0.2,
  volumes: 0.2,
  stabilite: 0.15,
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function scoreFiabilite(d: ProducteurData): number {
  const commandes_total = d.commandes_total ?? 0
  if (commandes_total === 0) return 0

  const commandes_honorees = d.commandes_honorees ?? 0
  const commandes_annulees = d.commandes_annulees ?? 0
  const delai = d.delai_moyen_livraison_heures ?? 0

  const taux_honorees = commandes_honorees / commandes_total
  const taux_annulation = commandes_annulees / commandes_total
  const penalite_delai = delai > 24 ? Math.max(0, ((delai - 24) / 24) * 10) : 0
  const score = taux_honorees * 80 - taux_annulation * 30 - penalite_delai
  const bonus_volume = Math.min(20, commandes_total / 5)
  return clamp(score + bonus_volume, 0, 100)
}

export function scoreQualite(d: ProducteurData): number {
  const nb_evaluations = d.nb_evaluations ?? 0
  if (nb_evaluations === 0) return 30 // score neutre

  const note = d.note_moyenne_acheteurs ?? 0
  const litiges_ouverts = d.litiges_ouverts ?? 0
  const litiges_resolus = d.litiges_resolus ?? 0
  const certifications = d.certifications_count ?? 0

  const note_normalisee = (note / 5) * 70
  const litiges_nets = Math.max(0, litiges_ouverts - litiges_resolus)
  const penalite_litiges = litiges_nets * 10
  const bonus_certif = Math.min(20, certifications * 7)
  const bonus_nb = Math.min(10, nb_evaluations / 2)
  return clamp(note_normalisee - penalite_litiges + bonus_certif + bonus_nb, 0, 100)
}

export function scoreEngagement(d: ProducteurData): number {
  const jours = d.jours_actif_plateforme ?? 0
  const formations = d.formations_suivies ?? 0
  const parrainage = d.parrainage_count ?? 0

  const score_anciennete = Math.min(30, jours / 3)
  const score_formations = Math.min(25, formations * 8)
  const score_coop = d.cooperative_active ? 20 : 0
  const score_parrainage = Math.min(15, parrainage * 5)
  const score_activite = Math.min(10, jours / 10)
  return Math.min(100, score_anciennete + score_formations + score_coop + score_parrainage + score_activite)
}

export function scoreVolumes(d: ProducteurData): number {
  const gmv = d.gmv_cumule_fcfa ?? 0
  const mois = d.mois_actif_consecutifs ?? 0
  const variation = d.variation_volume_pct ?? 0

  let score_gmv: number
  if (gmv >= 5_000_000) score_gmv = 40
  else if (gmv >= 1_000_000) score_gmv = 30
  else if (gmv >= 500_000) score_gmv = 20
  else if (gmv >= 100_000) score_gmv = 10
  else score_gmv = Math.max(0, gmv / 10_000)

  const score_regularite = Math.min(35, mois * 5)

  let score_croissance: number
  if (variation > 20) score_croissance = 25
  else if (variation > 0) score_croissance = 15
  else if (variation === 0) score_croissance = 5
  else score_croissance = 0

  return Math.min(100, score_gmv + score_regularite + score_croissance)
}

export function scoreStabilite(d: ProducteurData): number {
  const offres = d.offres_publiees_total ?? 0
  if (offres === 0) return 0

  const regularite = d.regularite_publication_score ?? 0
  const ruptures = d.ruptures_stock_count ?? 0

  const score_reg = regularite * 60
  const score_offres = Math.min(25, offres * 2)
  const penalite_ruptures = Math.min(30, ruptures * 5)
  return clamp(score_reg + score_offres - penalite_ruptures, 0, 100)
}

export function getBadge(score: number): { id: string; label: string } {
  if (score >= 800) return { id: "excellence", label: "Excellence" }
  if (score >= 600) return { id: "confirme", label: "Confirmé" }
  if (score >= 400) return { id: "actif", label: "Actif" }
  if (score >= 200) return { id: "debutant", label: "Débutant" }
  return { id: "insuffisant", label: "Insuffisant" }
}

const DIMENSION_LABELS: Record<keyof SCGDimensions, string> = {
  fiabilite: "Fiabilité transactions",
  qualite: "Qualité produit",
  engagement: "Engagement réseau",
  volumes: "Historique volumes",
  stabilite: "Stabilité approvisionnement",
}

export function getRecommandation(score: number, dims: SCGDimensions): string {
  const faible = (Object.entries(dims) as [keyof SCGDimensions, number][])
    .filter(([, v]) => v < 40)
    .map(([k]) => DIMENSION_LABELS[k])

  if (score >= 700) {
    return "Profil bancable — Éligible crédit agricole. Partager avec partenaires bancaires."
  }
  if (score >= 500) {
    const recs = faible.length ? `Améliorer : ${faible.slice(0, 2).join(", ")}` : "Augmenter les volumes et la régularité."
    return `Profil intermédiaire — ${recs}`
  }
  if (score >= 300) {
    const focus = faible.length ? faible.slice(0, 2).join(", ") : "la régularité des transactions"
    return `Profil en développement — Focus sur : ${focus}.`
  }
  return "Profil insuffisant — Effectuer au moins 5 transactions pour activer le score complet."
}

export function calculateSCG(data: ProducteurData): SCGResult {
  const d1 = scoreFiabilite(data)
  const d2 = scoreQualite(data)
  const d3 = scoreEngagement(data)
  const d4 = scoreVolumes(data)
  const d5 = scoreStabilite(data)

  const score_brut =
    d1 * POIDS.fiabilite + d2 * POIDS.qualite + d3 * POIDS.engagement + d4 * POIDS.volumes + d5 * POIDS.stabilite
  const score_total = Math.round(score_brut * 10) // 0-1000

  const dimensions: SCGDimensions = {
    fiabilite: Math.round(d1),
    qualite: Math.round(d2),
    engagement: Math.round(d3),
    volumes: Math.round(d4),
    stabilite: Math.round(d5),
  }

  const badge = getBadge(score_total)

  return {
    user_id: data.user_id,
    score_total,
    badge: badge.id,
    badge_label: badge.label,
    dimensions,
    recommandation: getRecommandation(score_total, dimensions),
    bancable: score_total >= 500,
    calculated_at: new Date().toISOString(),
  }
}

export const DIMENSION_META: { key: keyof SCGDimensions; label: string; weight: number }[] = [
  { key: "fiabilite", label: "Fiabilité transactions", weight: 25 },
  { key: "qualite", label: "Qualité produit", weight: 20 },
  { key: "engagement", label: "Engagement réseau", weight: 20 },
  { key: "volumes", label: "Historique volumes", weight: 20 },
  { key: "stabilite", label: "Stabilité approvisionnement", weight: 15 },
]
