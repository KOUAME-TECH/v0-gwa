/**
 * SCG — méthode bancaire des 5C (Caractère, Capacité, Capital, Collatéral, Conditions).
 * Moteur pur, sans accès réseau : les données viennent de public.scg_5c_inputs (migration 085),
 * appelée côté serveur uniquement (service role). Documentation : docs/scg-5c.md.
 *
 * Règles :
 *  - chaque pilier = somme de facteurs, borné 0–100 ;
 *  - total = Σ pilier × poids × 10, borné 0–1000 ;
 *  - donnée absente → valeur « neutre prudente » explicite (jamais de bonus) ;
 *  - plafonds anti-fraude appliqués après le calcul ;
 *  - explication : 3 facteurs qui font monter, 3 qui font baisser.
 */
import { clampScg, SCG_BANCABLE_MIN } from "@/lib/scg/scale"

export const SCG_MODEL_VERSION = "5c-v1"

export type PillarKey = "character" | "capacity" | "capital" | "collateral" | "conditions"

/** Poids en % (total 100). Justification : docs/scg-5c.md §3. */
export const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  character: 25,
  capacity: 25,
  capital: 15,
  collateral: 20,
  conditions: 15,
}

export const PILLAR_META: { key: PillarKey; label: string; question: string; weight: number }[] = [
  { key: "character", label: "Caractère", question: "Peut-on te faire confiance ?", weight: PILLAR_WEIGHTS.character },
  { key: "capacity", label: "Capacité", question: "Vends-tu régulièrement ?", weight: PILLAR_WEIGHTS.capacity },
  { key: "capital", label: "Capital", question: "Qu’as-tu construit ?", weight: PILLAR_WEIGHTS.capital },
  { key: "collateral", label: "Garanties", question: "Qu’est-ce qui sécurise un prêt ?", weight: PILLAR_WEIGHTS.collateral },
  { key: "conditions", label: "Conditions", question: "Ta filière et ta zone sont-elles favorables ?", weight: PILLAR_WEIGHTS.conditions },
]

/** Données d'entrée (clés identiques au jsonb de public.scg_5c_inputs). */
export interface ScgInputs {
  user_id: string
  exists?: boolean
  user_type?: string | null
  account_age_days?: number | null
  kyc_verified?: boolean | null
  rccm_verified?: boolean | null
  phone_verified?: boolean | null
  email_present?: boolean | null
  is_suspended?: boolean | null
  reviews_count?: number | null
  reviews_avg?: number | null
  self_reviews?: number | null
  orders_total?: number | null
  orders_completed?: number | null
  orders_cancelled?: number | null
  orders_late?: number | null
  disputes_total?: number | null
  disputes_lost?: number | null
  reports_upheld?: number | null
  msgs_received?: number | null
  msgs_replied_48h?: number | null
  reply_median_minutes?: number | null
  courses_completed?: number | null
  gmv_12m_fcfa?: number | null
  orders_completed_12m?: number | null
  active_months_12m?: number | null
  gmv_30d_fcfa?: number | null
  gmv_prev_150d_fcfa?: number | null
  distinct_buyers?: number | null
  top_buyer_share?: number | null
  self_orders?: number | null
  linked_orders?: number | null
  buyer_tranches_due?: number | null
  buyer_tranches_late?: number | null
  revenue_total_fcfa?: number | null
  stock_value_fcfa?: number | null
  coop_stock_qty?: number | null
  surface_ha?: number | null
  storage_or_vehicle?: boolean | null
  activity_start_year?: number | null
  escrow_held_fcfa?: number | null
  receivables_fcfa?: number | null
  factoring_outstanding_fcfa?: number | null
  coop_member?: boolean | null
  coop_verified?: boolean | null
  gps_parcels?: number | null
  certifications?: number | null
  main_filiere?: string | null
  filieres_count?: number | null
  country?: string | null
  country_supported?: boolean | null
  region_known?: boolean | null
  price_gap_pct?: number | null
  subscription_tier?: string | null
}

export type FactorStatus = "ok" | "partial" | "missing" | "penalty"

export interface ScgFactor {
  key: string
  pillar: PillarKey
  label: string
  points: number // points obtenus dans le pilier (peut être négatif pour une pénalité)
  max: number // points maximum dans le pilier
  status: FactorStatus
  /** Phrase simple, au tutoiement, affichée à l'utilisateur. */
  sentence: string
  /** Conseil pour gagner les points manquants. */
  tip?: string
}

export interface ScgCap {
  key: "suspended" | "kyc" | "young_account" | "report_upheld" | "concentration" | "volume_spike" | "self_dealing"
  label: string
  /** Plafond du score total (0–1000) ou du pilier concerné (0–100). */
  limit: number
  scope: "total" | PillarKey
}

export interface ScgExplainItem {
  key: string
  pillar: PillarKey | "cap"
  /** Impact en points sur 1000 (positif = fait monter, négatif = fait baisser). */
  impact: number
  sentence: string
}

export interface FiveCResult {
  model_version: typeof SCG_MODEL_VERSION
  score_total: number
  pillars: Record<PillarKey, number>
  factors: ScgFactor[]
  caps: ScgCap[]
  flags: string[]
  top_up: ScgExplainItem[]
  top_down: ScgExplainItem[]
  bancable: boolean
}

// ───────────────────────── helpers ─────────────────────────

const n = (v: number | null | undefined): number => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v))
const has = (v: number | null | undefined): boolean => v != null && Number.isFinite(Number(v))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/** Échelle logarithmique : 0 FCFA → 0, `full` FCFA → max. */
export function logScale(amount: number, full: number, max: number): number {
  if (amount <= 0) return 0
  return clamp((max * Math.log10(1 + amount / 1000)) / Math.log10(1 + full / 1000), 0, max)
}

function fcfa(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`
}

function factor(
  pillar: PillarKey,
  key: string,
  label: string,
  points: number,
  max: number,
  status: FactorStatus,
  sentence: string,
  tip?: string,
): ScgFactor {
  return { pillar, key, label, points: r1(points), max, status, sentence, tip }
}

/** Neutre prudent : 40 % du maximum pour un facteur « qualité » sans donnée (jamais de bonus). */
export const NEUTRAL_RATIO = 0.4

// ───────────────────────── Conditions : référentiels ─────────────────────────

/** Risque filière (max 30). Hypothèses documentées dans docs/scg-5c.md §4.5. */
export const FILIERE_RISK: Record<string, number> = {
  cacao: 30,
  cafe: 27,
  anacarde: 24,
  coton: 24,
  palmier: 22,
  hevea: 20,
  riz: 20,
  mais: 18,
  igname: 18,
  manioc: 18,
  banane: 18,
  plantain: 18,
  vivrier: 18,
  artisanat: 18,
  maraicher: 15,
  elevage: 15,
  peche: 15,
}
export const FILIERE_UNKNOWN = 12

/** Mois de récolte / de vente (1–12), Côte d'Ivoire. Absent = production toute l'année. */
export const HARVEST_MONTHS: Record<string, number[]> = {
  cacao: [10, 11, 12, 1, 2, 3, 5, 6, 7],
  cafe: [11, 12, 1, 2, 3],
  anacarde: [2, 3, 4, 5, 6],
  coton: [10, 11, 12, 1],
  palmier: [3, 4, 5, 6, 7],
  hevea: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  riz: [6, 7, 8, 11, 12],
  mais: [7, 8, 9, 10],
  igname: [8, 9, 10, 11, 12],
}

export function normalizeFiliere(f: string | null | undefined): string | null {
  if (!f) return null
  const k = f
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "")
  if (!k || k === "autre" || k === "autres" || k === "other") return null
  if (k.startsWith("cacao")) return "cacao"
  if (k.startsWith("cafe")) return "cafe"
  if (k.includes("anacard") || k.includes("cajou")) return "anacarde"
  if (k.includes("hevea") || k.includes("caoutchouc")) return "hevea"
  if (k.includes("palm")) return "palmier"
  if (k.includes("maraich") || k.includes("legume") || k.includes("tomate")) return "maraicher"
  if (k.includes("elevage") || k.includes("volaille") || k.includes("betail")) return "elevage"
  if (k.includes("plantain")) return "plantain"
  return k in FILIERE_RISK ? k : null
}

// ───────────────────────── piliers ─────────────────────────

function character(d: ScgInputs): ScgFactor[] {
  const P: PillarKey = "character"
  const out: ScgFactor[] = []
  const kyc = !!d.kyc_verified
  out.push(
    factor(P, "kyc", "Identité vérifiée", kyc ? 20 : 0, 20, kyc ? "ok" : "missing",
      kyc ? "Ton identité est vérifiée." : "Ton identité n’est pas encore vérifiée.",
      "Fais vérifier ta pièce d’identité dans ton profil."),
  )
  const rccm = !!d.rccm_verified
  out.push(
    factor(P, "rccm", "Entreprise ou coopérative enregistrée", rccm ? 5 : 0, 5, rccm ? "ok" : "missing",
      rccm ? "Ton enregistrement (RCCM) est vérifié." : "Aucun enregistrement RCCM vérifié.",
      "Ajoute ton numéro RCCM si tu en as un."),
  )
  const contact = (d.phone_verified ? 8 : 0) + (d.email_present ? 2 : 0)
  out.push(
    factor(P, "contact", "Téléphone et email", contact, 10, contact >= 10 ? "ok" : contact > 0 ? "partial" : "missing",
      d.phone_verified ? "Ton téléphone est vérifié." : "Ton téléphone n’est pas vérifié.",
      "Vérifie ton numéro de téléphone."),
  )
  const age = n(d.account_age_days)
  const agePts = clamp((age / 365) * 15, 0, 15)
  out.push(
    factor(P, "seniority", "Ancienneté sur GWA", agePts, 15, age >= 365 ? "ok" : "partial",
      age >= 365 ? "Tu es sur GWA depuis plus d’un an." : `Tu es sur GWA depuis ${age} jour${age > 1 ? "s" : ""}.`,
      "L’ancienneté compte : reste actif, elle monte toute seule."),
  )
  // Avis reçus (hors auto-avis) : moyenne × confiance (5 avis = confiance pleine)
  const nr = n(d.reviews_count)
  if (nr > 0 && has(d.reviews_avg)) {
    const conf = Math.min(1, nr / 5)
    const pts = conf * (n(d.reviews_avg) / 5) * 20 + (1 - conf) * 20 * NEUTRAL_RATIO
    out.push(
      factor(P, "reviews", "Avis des acheteurs", pts, 20, n(d.reviews_avg) >= 4 ? "ok" : "partial",
        `Tes acheteurs te notent ${n(d.reviews_avg).toFixed(1).replace(".", ",")}/5 (${nr} avis).`,
        "Demande un avis après chaque livraison réussie."),
    )
  } else {
    out.push(
      factor(P, "reviews", "Avis des acheteurs", 20 * NEUTRAL_RATIO, 20, "missing",
        "Pas encore d’avis d’acheteurs.", "Demande un avis après chaque livraison réussie."),
    )
  }
  // Engagements tenus (vendeur) : livrées / (livrées + annulées après paiement + litiges)
  const done = n(d.orders_completed)
  const bad = n(d.orders_cancelled) + n(d.disputes_total)
  if (done + bad > 0) {
    const conf = Math.min(1, (done + bad) / 5)
    const rate = done / (done + bad)
    const latePenalty = done > 0 ? (n(d.orders_late) / done) * 0.3 : 0
    const pts = conf * clamp(rate - latePenalty, 0, 1) * 20 + (1 - conf) * 20 * NEUTRAL_RATIO
    out.push(
      factor(P, "commitments", "Engagements tenus", pts, 20, rate >= 0.9 ? "ok" : "partial",
        `${done} commande${done > 1 ? "s" : ""} livrée${done > 1 ? "s" : ""} sur ${done + bad}.`,
        "Livre à la date promise et évite les annulations."),
    )
  } else {
    out.push(
      factor(P, "commitments", "Engagements tenus", 20 * NEUTRAL_RATIO, 20, "missing",
        "Pas encore de commande livrée.", "Réussis tes premières ventes."),
    )
  }
  const received = n(d.msgs_received)
  if (received >= 3) {
    const rate = n(d.msgs_replied_48h) / received
    out.push(
      factor(P, "reactivity", "Réponse aux messages", rate * 10, 10, rate >= 0.8 ? "ok" : "partial",
        `Tu réponds à ${Math.round(rate * 100)} % des messages en moins de 48 h.`,
        "Réponds aux messages des acheteurs dans la journée."),
    )
  } else {
    out.push(
      factor(P, "reactivity", "Réponse aux messages", 10 * NEUTRAL_RATIO, 10, "missing",
        "Pas assez de messages pour mesurer ta réactivité.", "Réponds vite aux messages des acheteurs."),
    )
  }
  const incidents = n(d.disputes_lost) * 10 + n(d.reports_upheld) * 15 + n(d.buyer_tranches_late) * 5
  if (incidents > 0) {
    out.push(
      factor(P, "incidents", "Incidents", -Math.min(60, incidents), 0, "penalty",
        `Incidents : ${n(d.disputes_lost)} litige(s) perdu(s), ${n(d.reports_upheld)} signalement(s) confirmé(s), ${n(d.buyer_tranches_late)} paiement(s) en retard.`,
        "Règle les litiges à l’amiable et paie à temps."),
    )
  }
  return out
}

function capacity(d: ScgInputs): ScgFactor[] {
  const P: PillarKey = "capacity"
  const gmv = n(d.gmv_12m_fcfa)
  const orders = n(d.orders_completed_12m)
  const months = n(d.active_months_12m)
  const buyers = n(d.distinct_buyers)
  const out: ScgFactor[] = [
    factor(P, "sales_volume", "Chiffre d’affaires 12 mois", logScale(gmv, 5_000_000, 35), 35, gmv > 0 ? (gmv >= 5_000_000 ? "ok" : "partial") : "missing",
      gmv > 0 ? `Tu as vendu pour ${fcfa(gmv)} en 12 mois.` : "Aucune vente livrée sur 12 mois.",
      "Chaque vente livrée sur GWA augmente ta capacité prouvée."),
    factor(P, "sales_count", "Nombre de ventes livrées", Math.min(20, orders * 2), 20, orders >= 10 ? "ok" : orders > 0 ? "partial" : "missing",
      `${orders} vente${orders > 1 ? "s" : ""} livrée${orders > 1 ? "s" : ""} en 12 mois.`,
      "Vise au moins une vente par mois."),
    factor(P, "regularity", "Régularité", (months / 12) * 25, 25, months >= 9 ? "ok" : months > 0 ? "partial" : "missing",
      `Tu as vendu pendant ${months} mois sur les 12 derniers.`,
      "Vendre un peu chaque mois rassure plus qu’une grosse vente isolée."),
    factor(P, "buyers", "Nombre d’acheteurs différents", Math.min(10, buyers * 2.5), 10, buyers >= 4 ? "ok" : buyers > 0 ? "partial" : "missing",
      `${buyers} acheteur${buyers > 1 ? "s" : ""} différent${buyers > 1 ? "s" : ""}.`,
      "Diversifie tes acheteurs."),
  ]
  const due = n(d.buyer_tranches_due)
  if (due > 0) {
    const ontime = 1 - n(d.buyer_tranches_late) / due
    out.push(
      factor(P, "payments", "Paiements à temps", clamp(ontime, 0, 1) * 10, 10, ontime >= 0.95 ? "ok" : "partial",
        `Tu as payé ${Math.round(clamp(ontime, 0, 1) * 100)} % de tes échéances à temps.`,
        "Paie tes tranches avant l’échéance."),
    )
  } else {
    out.push(
      factor(P, "payments", "Paiements à temps", 10 * NEUTRAL_RATIO, 10, "missing",
        "Pas encore d’échéance de paiement à évaluer.", "Paie tes achats à temps."),
    )
  }
  return out
}

function capital(d: ScgInputs, now: Date): ScgFactor[] {
  const P: PillarKey = "capital"
  const rev = n(d.revenue_total_fcfa)
  const stock = n(d.stock_value_fcfa)
  const surface = n(d.surface_ha)
  const startYear = n(d.activity_start_year)
  const years = startYear > 1950 ? clamp(now.getFullYear() - startYear, 0, 60) : 0
  return [
    factor(P, "revenue_total", "Revenus cumulés", logScale(rev, 10_000_000, 45), 45, rev > 0 ? "partial" : "missing",
      rev > 0 ? `Tu as encaissé ${fcfa(rev)} sur GWA.` : "Pas encore de revenu encaissé sur GWA.",
      "Encaisse tes ventes via GWA (séquestre) pour qu’elles comptent."),
    factor(P, "stock_value", "Valeur du stock publié", logScale(stock, 2_000_000, 25), 25, stock > 0 ? "partial" : "missing",
      stock > 0 ? `Ton stock publié vaut environ ${fcfa(stock)}.` : "Aucun stock publié avec prix et quantité.",
      "Publie tes offres avec un prix et une quantité réels."),
    factor(P, "land", "Surface exploitée", clamp((surface / 5) * 15, 0, 15), 15, surface > 0 ? "partial" : "missing",
      surface > 0 ? `Tu déclares ${r1(surface).toString().replace(".", ",")} ha.` : "Surface exploitée non renseignée.",
      "Renseigne ta surface dans ton profil."),
    factor(P, "equipment", "Stockage ou transport", d.storage_or_vehicle ? 5 : 0, 5, d.storage_or_vehicle ? "ok" : "missing",
      d.storage_or_vehicle ? "Tu as un moyen de stockage ou de transport." : "Pas de stockage ni de transport déclaré.",
      "Déclare ton magasin ou ton véhicule."),
    factor(P, "experience", "Années d’activité", clamp(years, 0, 10), 10, years >= 10 ? "ok" : years > 0 ? "partial" : "missing",
      years > 0 ? `${years} an${years > 1 ? "s" : ""} d’activité déclarée${years > 1 ? "s" : ""}.` : "Années d’activité non renseignées.",
      "Indique l’année de début de ton activité."),
  ]
}

function collateral(d: ScgInputs): ScgFactor[] {
  const P: PillarKey = "collateral"
  const escrow = n(d.escrow_held_fcfa)
  const recv = Math.max(0, n(d.receivables_fcfa) - n(d.factoring_outstanding_fcfa))
  const gps = n(d.gps_parcels)
  const certs = n(d.certifications)
  const coopPts = d.coop_member ? (d.coop_verified ? 25 : 12) : 0
  return [
    factor(P, "escrow", "Ventes sécurisées en séquestre", logScale(escrow, 2_000_000, 25), 25, escrow > 0 ? "partial" : "missing",
      escrow > 0 ? `${fcfa(escrow)} de ventes payées sont en séquestre.` : "Aucune vente en cours en séquestre.",
      "Fais payer tes ventes via le séquestre GWA."),
    factor(P, "receivables", "Créances affacturables", logScale(recv, 2_000_000, 20), 20, recv > 0 ? "partial" : "missing",
      recv > 0 ? `${fcfa(recv)} de ventes livrées restent à encaisser.` : "Pas de créance disponible à céder.",
      "Les ventes livrées et non encore payées peuvent servir de garantie."),
    factor(P, "coop", "Caution de la coopérative", coopPts, 25, d.coop_verified ? "ok" : d.coop_member ? "partial" : "missing",
      d.coop_member
        ? d.coop_verified
          ? "Tu es membre d’une coopérative vérifiée."
          : "Ta coopérative n’est pas encore vérifiée."
        : "Tu n’es membre d’aucune coopérative sur GWA.",
      "Rejoins ta coopérative sur GWA (code d’invitation)."),
    factor(P, "parcels", "Parcelles géolocalisées", gps > 0 ? 15 : 0, 15, gps > 0 ? "ok" : "missing",
      gps > 0 ? "Ta parcelle est géolocalisée (traçabilité EUDR)." : "Aucune parcelle géolocalisée.",
      "Ajoute la position GPS de ton champ."),
    factor(P, "certifications", "Certifications", Math.min(15, certs * 7.5), 15, certs >= 2 ? "ok" : certs > 0 ? "partial" : "missing",
      certs > 0 ? `${certs} certification${certs > 1 ? "s" : ""} déclarée${certs > 1 ? "s" : ""}.` : "Aucune certification déclarée.",
      "Déclare tes certifications (bio, commerce équitable, Rainforest…)."),
  ]
}

function conditions(d: ScgInputs, now: Date): ScgFactor[] {
  const P: PillarKey = "conditions"
  const f = normalizeFiliere(d.main_filiere)
  const sector = f ? (FILIERE_RISK[f] ?? FILIERE_UNKNOWN) : FILIERE_UNKNOWN
  const month = now.getMonth() + 1
  let season: number
  let seasonSentence: string
  if (!f) {
    season = 20 * 0.5
    seasonSentence = "Filière inconnue : saison neutre."
  } else if (!HARVEST_MONTHS[f]) {
    season = 16
    seasonSentence = "Ta filière produit toute l’année."
  } else if (HARVEST_MONTHS[f].includes(month)) {
    season = 20
    seasonSentence = "C’est la saison de vente de ta filière."
  } else {
    season = 12
    seasonSentence = "Hors saison de vente pour ta filière."
  }
  const zone = d.country_supported ? (d.region_known ? 20 : 12) : 6
  let price: number
  let priceSentence: string
  if (has(d.price_gap_pct)) {
    const gap = n(d.price_gap_pct)
    price = gap <= 10 ? 15 : gap <= 25 ? 9 : 3
    priceSentence = `Tes prix sont à ${Math.round(gap)} % du prix de référence.`
  } else {
    price = 15 * 0.45
    priceSentence = "Pas de prix de référence pour comparer tes prix."
  }
  const nf = n(d.filieres_count)
  const div = nf >= 2 ? 15 : nf === 1 ? 8 : 5
  return [
    factor(P, "sector", "Risque de la filière", sector, 30, f ? (sector >= 24 ? "ok" : "partial") : "missing",
      f ? `Filière principale : ${f}.` : "Filière principale non renseignée.",
      "Indique tes filières dans ton profil."),
    factor(P, "season", "Saisonnalité", season, 20, f ? "partial" : "missing", seasonSentence),
    factor(P, "zone", "Zone", zone, 20, zone >= 20 ? "ok" : "partial",
      d.country_supported ? (d.region_known ? "Ta zone est couverte par GWA." : "Ta ville ou ta région n’est pas renseignée.") : "Pays non couvert par GWA.",
      "Renseigne ta ville et tes zones de production."),
    factor(P, "price", "Risque de prix", price, 15, has(d.price_gap_pct) ? (price >= 15 ? "ok" : "partial") : "missing", priceSentence,
      "Aligne tes prix sur le prix de référence."),
    factor(P, "diversification", "Diversification", div, 15, nf >= 2 ? "ok" : nf === 1 ? "partial" : "missing",
      nf >= 2 ? `Tu travailles ${nf} filières.` : nf === 1 ? "Une seule filière." : "Aucune filière déclarée.",
      "Plusieurs filières réduisent le risque."),
  ]
}

// ───────────────────────── calcul ─────────────────────────

export function computeFiveC(d: ScgInputs, now: Date = new Date()): FiveCResult {
  const factors = [...character(d), ...capacity(d), ...capital(d, now), ...collateral(d), ...conditions(d, now)]
  const pillars = { character: 0, capacity: 0, capital: 0, collateral: 0, conditions: 0 } as Record<PillarKey, number>
  for (const f of factors) pillars[f.pillar] += f.points
  for (const k of Object.keys(pillars) as PillarKey[]) pillars[k] = Math.round(clamp(pillars[k], 0, 100))

  // Plafonds anti-fraude / prudence
  const caps: ScgCap[] = []
  const flags: string[] = []
  if (n(d.self_orders) > 0 || n(d.self_reviews) > 0 || n(d.linked_orders) > 0) {
    flags.push("self_dealing")
    caps.push({ key: "self_dealing", label: "Ventes ou avis entre comptes liés exclus et capacité plafonnée", limit: 60, scope: "capacity" })
  }
  const orders12 = n(d.orders_completed_12m)
  if (orders12 >= 3 && (n(d.distinct_buyers) <= 1 || n(d.top_buyer_share) > 0.8)) {
    flags.push("concentration")
    caps.push({ key: "concentration", label: "Ventes concentrées sur un seul acheteur", limit: 50, scope: "capacity" })
  }
  const prevMonthly = n(d.gmv_prev_150d_fcfa) / 5
  if (n(d.gmv_30d_fcfa) >= 500_000 && n(d.gmv_30d_fcfa) > 3 * prevMonthly) {
    flags.push("volume_spike")
    caps.push({ key: "volume_spike", label: "Hausse soudaine des ventes en cours de vérification", limit: 60, scope: "capacity" })
  }
  for (const c of caps) if (c.scope !== "total") pillars[c.scope] = Math.min(pillars[c.scope], c.limit)

  const raw = (Object.keys(pillars) as PillarKey[]).reduce((s, k) => s + pillars[k] * PILLAR_WEIGHTS[k], 0) / 100
  let total = clampScg(raw * 10)
  const uncapped = total

  if (d.is_suspended) caps.push({ key: "suspended", label: "Compte suspendu", limit: 199, scope: "total" })
  if (n(d.reports_upheld) > 0) caps.push({ key: "report_upheld", label: "Signalement confirmé par la modération", limit: 299, scope: "total" })
  if (!d.kyc_verified) caps.push({ key: "kyc", label: "Identité non vérifiée : pas bancable", limit: SCG_BANCABLE_MIN - 1, scope: "total" })
  if (n(d.account_age_days) < 90) caps.push({ key: "young_account", label: "Compte de moins de 90 jours : pas encore bancable", limit: SCG_BANCABLE_MIN - 1, scope: "total" })
  for (const c of caps) if (c.scope === "total") total = Math.min(total, c.limit)
  total = clampScg(total)

  // Explication : impact sur 1000 = points × poids × 10 / 100
  const w = (p: PillarKey) => PILLAR_WEIGHTS[p] / 10
  const up: ScgExplainItem[] = factors
    .filter((f) => f.points > 0 && f.status !== "missing")
    .map((f) => ({ key: f.key, pillar: f.pillar, impact: Math.round(f.points * w(f.pillar)), sentence: f.sentence }))
    .filter((e) => e.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
  const capItems: ScgExplainItem[] = caps
    .filter((c) => c.scope === "total" && c.limit < uncapped)
    .map((c) => ({ key: c.key, pillar: "cap" as const, impact: -(uncapped - c.limit), sentence: `${c.label}.` }))
  const down: ScgExplainItem[] = [
    ...capItems,
    ...factors
      .map((f) => {
        const lost = f.status === "penalty" ? -f.points : f.max - f.points
        return {
          key: f.key,
          pillar: f.pillar,
          impact: -Math.round(lost * w(f.pillar)),
          sentence: f.tip ? `${f.sentence} ${f.tip}` : f.sentence,
        }
      })
      .filter((e) => e.impact < 0)
      .sort((a, b) => a.impact - b.impact),
  ].slice(0, 3)

  const bancable =
    total >= SCG_BANCABLE_MIN && !!d.kyc_verified && !d.is_suspended && !flags.includes("self_dealing")

  return { model_version: SCG_MODEL_VERSION, score_total: total, pillars, factors, caps, flags, top_up: up, top_down: down, bancable }
}
