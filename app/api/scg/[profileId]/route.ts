import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteParams = { params: Promise<{ profileId: string }> }

const BADGE_LABELS: Record<string, string> = {
  excellence: "Excellence",
  confirme: "Confirmé",
  actif: "Actif",
  debutant: "Débutant",
  insuffisant: "Insuffisant",
  debut: "Débutant",
  fiable: "Fiable",
  expert: "Expert",
  elite: "Élite",
  cooperative_debutante: "Coop. débutante",
  cooperative_active: "Coop. active",
  cooperative_confiance: "Coop. confiance",
  cooperative_elite: "Coop. élite",
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { profileId } = await params
    const supabase = await createClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split("T")[0]
    const sinceIso = thirtyDaysAgo.toISOString()

    const [{ data: profile }, { data: latestScore }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, sub_type, scg_score, scg_badge, scg_bancable, scg_calculated_at")
        .eq("id", profileId)
        .maybeSingle(),
      supabase
        .from("scg_scores")
        .select(
          "score_total, badge, bancable, dim_fiabilite, dim_qualite, dim_engagement, dim_volumes, dim_stabilite, recommandation, created_at",
        )
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }

    const { data: historyRows, error: historyError } = await supabase
      .from("scg_history")
      .select("score_total, badge, snapshot_date")
      .eq("profile_id", profileId)
      .gte("snapshot_date", sinceDate)
      .order("snapshot_date", { ascending: true })

    let history =
      historyRows?.map((row) => ({
        score_total: row.score_total,
        badge: row.badge,
        date: row.snapshot_date,
      })) ?? []

    if (historyError || history.length === 0) {
      const { data: scoreSnapshots } = await supabase
        .from("scg_scores")
        .select("score_total, badge, created_at")
        .eq("user_id", profileId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })

      history =
        scoreSnapshots?.map((row) => ({
          score_total: row.score_total,
          badge: row.badge,
          date: row.created_at.split("T")[0],
        })) ?? []
    }

    const badge = profile.scg_badge ?? latestScore?.badge ?? "insuffisant"
    const scoreTotal = profile.scg_score ?? latestScore?.score_total ?? 0

    return NextResponse.json({
      score: {
        profile_id: profileId,
        score_total: scoreTotal,
        badge,
        badge_label: BADGE_LABELS[badge] ?? badge,
        bancable: profile.scg_bancable ?? latestScore?.bancable ?? scoreTotal >= 500,
        calculated_at: profile.scg_calculated_at ?? latestScore?.created_at ?? null,
        dimensions: latestScore
          ? {
              fiabilite: latestScore.dim_fiabilite,
              qualite: latestScore.dim_qualite,
              engagement: latestScore.dim_engagement,
              volumes: latestScore.dim_volumes,
              stabilite: latestScore.dim_stabilite,
            }
          : null,
        recommandation: latestScore?.recommandation ?? null,
      },
      history,
    })
  } catch (err) {
    console.error("[scg/[profileId]]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
