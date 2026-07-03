// GWA Platform — Supabase Edge Function : calculate-scg
// Moteur SCG (Score de Confiance GWA) — TypeScript Production
// Déployé via: supabase functions deploy calculate-scg

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// Types
// ============================================================
interface SCGInput {
  profile_id: string
  trigger_event?: 'order_delivered' | 'profile_updated' | 'rccm_verified' | 'manual'
  order_id?: string
}

interface Profile {
  id: string
  sub_type: 'producteur_individuel' | 'cooperative'
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  city: string | null
  filieres: string[]
  surface_ha: number | null
  coordonnees_gps: string | null
  rccm_numero: string | null
  rccm_verified: boolean
  president_name: string | null
  nb_membres: number | null
  zones_production: string[]
  profile_completion_pct: number
  certif_bio: boolean
  certif_fairtrade: boolean
  coop_id: string | null
}

interface OrderStats {
  total_commandes: number
  commandes_livrees: number
  commandes_en_litige: number
  litigues_perdus: number
  volume_total_kg: number
  valeur_totale_fcfa: number
  taux_livraison_pct: number
}

interface SCGResult {
  score_total: number
  badge: string
  profil_type: string
  score_fiabilite: number
  score_qualite: number
  score_volumes: number
  score_engagement: number
  score_institutionnel: number
  score_membres_pondere: number
  taux_livraison_pct: number
  nb_membres_actifs: number
  seuil_bancabilite: boolean
  eligible_credit: boolean
}

// ============================================================
// Calcul SCG Producteur Individuel
// Formule : 250 (fiabilite) + 200 (qualite) + 200 (volumes) +
//           150 (engagement) + 200 (institutionnel) = 1000 pts max
// ============================================================
function calculateSCGProducteur(profile: Profile, stats: OrderStats): SCGResult {
  let fiabilite = 0
  let qualite = 0
  let volumes = 0
  let engagement = 0
  let institutionnel = 0

  // --- FIABILITE (250 pts) ---
  // Taux de livraison dans les délais
  if (stats.total_commandes > 0) {
    const taux = stats.taux_livraison_pct
    if (taux >= 95)      fiabilite += 150
    else if (taux >= 85) fiabilite += 100
    else if (taux >= 70) fiabilite += 60
    else if (taux >= 50) fiabilite += 30

    // Litiges perdus (pénalité)
    const ratio_litige = stats.litigues_perdus / stats.total_commandes
    if (ratio_litige === 0)       fiabilite += 100
    else if (ratio_litige < 0.05) fiabilite += 60
    else if (ratio_litige < 0.15) fiabilite += 20
    // Pénalité si > 15% de litiges perdus : 0 pts
  } else {
    // Nouveau compte sans transaction
    fiabilite = 0
  }

  // --- QUALITE (200 pts) ---
  // Basé sur les notes reçues (moyennée sur toutes les commandes)
  // (les reviews sont calculées séparément via la moyenne des ratings)
  // Ici on utilise l'absence de litige comme proxy qualité
  if (stats.total_commandes === 0) {
    qualite = 0
  } else if (stats.commandes_en_litige === 0) {
    qualite = 150
    // + bonus conformité specs
    if (profile.certif_bio)       qualite += 30
    if (profile.certif_fairtrade) qualite += 20
  } else {
    const ratio = 1 - (stats.commandes_en_litige / stats.total_commandes)
    qualite = Math.round(ratio * 150)
  }

  // --- VOLUMES (200 pts) ---
  if (stats.volume_total_kg >= 100_000)     volumes = 200
  else if (stats.volume_total_kg >= 50_000) volumes = 160
  else if (stats.volume_total_kg >= 20_000) volumes = 120
  else if (stats.volume_total_kg >= 5_000)  volumes = 80
  else if (stats.volume_total_kg >= 1_000)  volumes = 40
  else if (stats.volume_total_kg > 0)       volumes = 20

  // --- ENGAGEMENT (150 pts) ---
  // Complétude du profil
  engagement += Math.round((profile.profile_completion_pct / 100) * 80)
  // GPS parcelle renseigné
  if (profile.coordonnees_gps) engagement += 30
  // Filières renseignées
  if (profile.filieres && profile.filieres.length > 0) engagement += 20
  // Surface renseignée
  if (profile.surface_ha) engagement += 20

  // --- INSTITUTIONNEL (200 pts) ---
  // Pas de RCCM pour producteur individuel — basé sur vérification compte
  // Photo profil
  if (profile.avatar_url) institutionnel += 40
  // Bio complète
  if (profile.bio && profile.bio.length > 50) institutionnel += 30
  // Ville renseignée
  if (profile.city) institutionnel += 20
  // Certifications
  if (profile.certif_bio)       institutionnel += 50
  if (profile.certif_fairtrade) institutionnel += 30
  // Appartient à une coopérative
  if (profile.coop_id) institutionnel += 30

  const score_total = Math.min(
    fiabilite + qualite + volumes + engagement + institutionnel,
    1000
  )

  const badge = computeBadge(score_total, 'producteur_individuel')

  return {
    score_total,
    badge,
    profil_type: 'producteur_individuel',
    score_fiabilite:       Math.min(fiabilite, 250),
    score_qualite:         Math.min(qualite, 200),
    score_volumes:         Math.min(volumes, 200),
    score_engagement:      Math.min(engagement, 150),
    score_institutionnel:  Math.min(institutionnel, 200),
    score_membres_pondere: 0,
    taux_livraison_pct:    stats.taux_livraison_pct,
    nb_membres_actifs:     0,
    seuil_bancabilite:     score_total >= 500,
    eligible_credit:       score_total >= 600,
  }
}

// ============================================================
// Calcul SCG Cooperative
// Formule : moyenne pondérée des membres + institutionnel coop
// ============================================================
function calculateSCGCooperative(
  profile: Profile,
  membresScores: Array<{ score_total: number; surface_ha: number | null }>,
  stats: OrderStats
): SCGResult {
  let score_membres_pondere = 0
  let institutionnel = 0
  let nb_membres_actifs = 0

  // --- MEMBRES PONDÉRÉS (600 pts max) ---
  if (membresScores.length > 0) {
    const totalSurface = membresScores.reduce((s, m) => s + (m.surface_ha || 1), 0)
    const scorePondere = membresScores.reduce((s, m) => {
      const poids = (m.surface_ha || 1) / totalSurface
      return s + m.score_total * poids
    }, 0)
    score_membres_pondere = Math.round((scorePondere / 1000) * 600)
    nb_membres_actifs = membresScores.length
  }

  // --- INSTITUTIONNEL COOP (400 pts max) ---
  if (profile.rccm_verified)                        institutionnel += 120
  else if (profile.rccm_numero)                     institutionnel += 60
  if (profile.president_name)                       institutionnel += 50
  if (profile.nb_membres && profile.nb_membres >= 10) institutionnel += 50
  if (profile.zones_production && profile.zones_production.length > 0) institutionnel += 40
  if (profile.avatar_url)                           institutionnel += 30
  if (profile.bio && profile.bio.length > 50)       institutionnel += 20
  if (stats.total_commandes > 0) {
    const activite_ratio = Math.min(stats.volume_total_kg / 100_000, 1)
    institutionnel += Math.round(activite_ratio * 90)
  }

  const score_total = Math.min(score_membres_pondere + institutionnel, 1000)
  const badge = computeBadge(score_total, 'cooperative')

  return {
    score_total,
    badge,
    profil_type: 'cooperative',
    score_fiabilite:       0,
    score_qualite:         0,
    score_volumes:         0,
    score_engagement:      0,
    score_institutionnel:  Math.min(institutionnel, 400),
    score_membres_pondere: Math.min(score_membres_pondere, 600),
    taux_livraison_pct:    stats.taux_livraison_pct,
    nb_membres_actifs,
    seuil_bancabilite:     score_total >= 500,
    eligible_credit:       score_total >= 600,
  }
}

function computeBadge(score: number, subType: string): string {
  if (subType === 'cooperative') {
    if (score >= 800) return 'cooperative_elite'
    if (score >= 600) return 'cooperative_confiance'
    if (score >= 300) return 'cooperative_active'
    return 'cooperative_debutante'
  }
  if (score >= 800) return 'elite'
  if (score >= 600) return 'expert'
  if (score >= 400) return 'fiable'
  if (score >= 200) return 'actif'
  return 'debut'
}

// ============================================================
// Handler principal
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const body: SCGInput = await req.json()
    const { profile_id } = body

    if (!profile_id) {
      return new Response(
        JSON.stringify({ error: 'profile_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Charger le profil
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single()

    if (pErr || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profil introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Charger les stats de commandes
    const { data: orders } = await supabase
      .from('orders')
      .select('order_status, escrow_status, montant_total_fcfa')
      .eq('seller_id', profile_id)

    const stats: OrderStats = (() => {
      const all = orders || []
      const livrees = all.filter(o => o.order_status === 'livre')
      const litiges = all.filter(o => o.order_status === 'litige')
      const litiges_perdus = all.filter(
        o => o.order_status === 'annule_rembourse' && o.escrow_status === 'refunded'
      )
      const total = all.length
      const valeur = livrees.reduce((s, o) => s + (o.montant_total_fcfa || 0), 0)

      return {
        total_commandes:     total,
        commandes_livrees:   livrees.length,
        commandes_en_litige: litiges.length,
        litigues_perdus:     litiges_perdus.length,
        volume_total_kg:     0, // calculé via order_items si nécessaire
        valeur_totale_fcfa:  valeur,
        taux_livraison_pct:  total > 0 ? Math.round((livrees.length / total) * 100) : 0,
      }
    })()

    let result: SCGResult

    if (profile.sub_type === 'cooperative') {
      // Charger les scores des membres
      const { data: membres } = await supabase
        .from('cooperative_members')
        .select('user_id, is_active')
        .eq('cooperative_id', profile_id)
        .eq('is_active', true)

      const membresIds = (membres || []).map((m: { user_id: string }) => m.user_id)

      const membresScores = membresIds.length > 0
        ? await (async () => {
            const { data } = await supabase
              .from('scg_scores')
              .select('score_total, profile_id')
              .in('profile_id', membresIds)

            const profilesData = await supabase
              .from('profiles')
              .select('id, surface_ha')
              .in('id', membresIds)

            return (data || []).map((s: { score_total: number; profile_id: string }) => ({
              score_total: s.score_total,
              surface_ha: (profilesData.data || []).find(
                (p: { id: string; surface_ha: number | null }) => p.id === s.profile_id
              )?.surface_ha || null,
            }))
          })()
        : []

      result = calculateSCGCooperative(profile as Profile, membresScores, stats)
    } else {
      result = calculateSCGProducteur(profile as Profile, stats)
    }

    // Récupérer le score précédent pour notifier si changement >= 20 pts
    const { data: prevScore } = await supabase
      .from('scg_scores')
      .select('score_total')
      .eq('profile_id', profile_id)
      .single()

    // Sauvegarder (upsert)
    const { error: uErr } = await supabase
      .from('scg_scores')
      .upsert({
        profile_id,
        ...result,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    if (uErr) throw uErr

    // Notification si changement >= 20 pts
    if (prevScore) {
      const delta = result.score_total - prevScore.score_total
      if (Math.abs(delta) >= 20) {
        await supabase.from('notifications').insert({
          user_id: profile_id,
          type: 'scg_change',
          title: delta > 0
            ? `Votre SCG a augmenté de +${delta} pts !`
            : `Votre SCG a baissé de ${Math.abs(delta)} pts`,
          message: delta > 0
            ? `Continuez comme ça ! Nouveau score : ${result.score_total}/1000`
            : `Score actuel : ${result.score_total}/1000`,
          body: delta > 0
            ? `Score : ${result.score_total}/1000 — Badge : ${result.badge}`
            : `Score : ${result.score_total}/1000`,
          data: { score_total: result.score_total, badge: result.badge, delta },
          read: false,
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[calculate-scg] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur SCG', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
