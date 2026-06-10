import { createClient } from "@/lib/supabase/server"
import type { ProducteurData } from "./engine"

/**
 * Agrège les données réelles d'un producteur depuis Supabase
 * pour alimenter le calcul du SCG.
 */
export async function aggregateProducerData(userId: string): Promise<ProducteurData> {
  const supabase = await createClient()

  // ── Profil (ancienneté, coopérative, certifications) ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, user_type, is_verified, city, country")
    .eq("id", userId)
    .single()

  const joursActif = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // ── Commandes en tant que vendeur ──
  const { data: orders } = await supabase
    .from("orders")
    .select("status, total_amount, created_at, delivered_at")
    .eq("seller_id", userId)

  const commandesTotal = orders?.length ?? 0
  const commandesHonorees = orders?.filter((o) => o.status === "delivered").length ?? 0
  const commandesAnnulees = orders?.filter((o) => o.status === "cancelled").length ?? 0

  // Délai moyen de livraison en heures (commandes livrées)
  const livrees = orders?.filter((o) => o.delivered_at && o.created_at) ?? []
  const delaiMoyen =
    livrees.length > 0
      ? livrees.reduce((sum, o) => {
          const h = (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60)
          return sum + h
        }, 0) / livrees.length
      : 0

  // GMV cumulé (commandes livrées)
  const gmvCumule =
    orders?.filter((o) => o.status === "delivered").reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0

  // Mois actifs consécutifs (approximation depuis les dates de commande)
  const moisActifs = computeConsecutiveActiveMonths(orders?.map((o) => o.created_at) ?? [])

  // Variation de volume (mois courant vs mois précédent)
  const variationVolume = computeVolumeVariation(
    orders?.map((o) => ({ date: o.created_at, amount: Number(o.total_amount || 0) })) ?? []
  )

  // ── Avis reçus ──
  const { data: reviews } = await supabase.from("reviews").select("rating").eq("seller_id", userId)

  const nbEvaluations = reviews?.length ?? 0
  const noteMoyenne = nbEvaluations > 0 ? reviews!.reduce((s, r) => s + (r.rating || 0), 0) / nbEvaluations : 0

  // ── Litiges ──
  let litigesOuverts = 0
  let litigesResolus = 0
  const { data: disputes } = await supabase.from("disputes").select("status").eq("respondent_id", userId)
  if (disputes) {
    litigesOuverts = disputes.filter((d) => d.status === "open" || d.status === "pending").length
    litigesResolus = disputes.filter((d) => d.status === "resolved" || d.status === "closed").length
  }

  // ── Produits / offres publiées ──
  const { data: products } = await supabase
    .from("products")
    .select("status, stock_quantity, created_at")
    .eq("seller_id", userId)

  const offresPubliees = products?.length ?? 0
  const rupturesStock = products?.filter((p) => (p.stock_quantity ?? 0) <= 0).length ?? 0
  const regularitePublication = computePublicationRegularity(products?.map((p) => p.created_at) ?? [])

  // ── Engagement: formations suivies ──
  let formationsSuivies = 0
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", userId)
  formationsSuivies = enrollments?.length ?? 0

  // ── Coopérative active ──
  let cooperativeActive = false
  const { data: coopMember } = await supabase
    .from("cooperative_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
  cooperativeActive = (coopMember?.length ?? 0) > 0 || profile?.user_type === "cooperative"

  // ── Certifications (depuis profil vérifié comme proxy) ──
  const certificationsCount = profile?.is_verified ? 1 : 0

  return {
    user_id: userId,
    commandes_total: commandesTotal,
    commandes_honorees: commandesHonorees,
    delai_moyen_livraison_heures: delaiMoyen,
    commandes_annulees: commandesAnnulees,
    note_moyenne_acheteurs: noteMoyenne,
    nb_evaluations: nbEvaluations,
    litiges_ouverts: litigesOuverts,
    litiges_resolus: litigesResolus,
    certifications_count: certificationsCount,
    jours_actif_plateforme: joursActif,
    formations_suivies: formationsSuivies,
    cooperative_active: cooperativeActive,
    parrainage_count: 0,
    gmv_cumule_fcfa: gmvCumule,
    mois_actif_consecutifs: moisActifs,
    variation_volume_pct: variationVolume,
    offres_publiees_total: offresPubliees,
    regularite_publication_score: regularitePublication,
    ruptures_stock_count: rupturesStock,
  }
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function computeConsecutiveActiveMonths(dates: string[]): number {
  if (dates.length === 0) return 0
  const months = new Set(dates.map(monthKey))
  // Compter le nombre de mois consécutifs jusqu'au mois courant
  let count = 0
  const cursor = new Date()
  while (count < 36) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    if (months.has(key)) {
      count++
      cursor.setMonth(cursor.getMonth() - 1)
    } else {
      break
    }
  }
  return count
}

function computeVolumeVariation(entries: { date: string; amount: number }[]): number {
  if (entries.length === 0) return 0
  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const prev = new Date(now)
  prev.setMonth(prev.getMonth() - 1)
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

  const sumCurrent = entries.filter((e) => monthKey(e.date) === currentKey).reduce((s, e) => s + e.amount, 0)
  const sumPrev = entries.filter((e) => monthKey(e.date) === prevKey).reduce((s, e) => s + e.amount, 0)

  if (sumPrev === 0) return sumCurrent > 0 ? 100 : 0
  return ((sumCurrent - sumPrev) / sumPrev) * 100
}

function computePublicationRegularity(dates: string[]): number {
  if (dates.length < 2) return dates.length === 1 ? 0.3 : 0
  // Régularité = fraction des 6 derniers mois où au moins une offre a été publiée
  const months = new Set(dates.map(monthKey))
  let activeMonths = 0
  const cursor = new Date()
  for (let i = 0; i < 6; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    if (months.has(key)) activeMonths++
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return Math.min(1, activeMonths / 6)
}
