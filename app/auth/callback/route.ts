import { createClient } from "@/lib/supabase/server"
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth"
import { NextResponse } from "next/server"

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))
  const error = searchParams.get("error")
  const error_description = searchParams.get("error_description")

  // Handle error from Supabase
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || "Une erreur s'est produite")}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=exchange_error&message=${encodeURIComponent(exchangeError.message)}`
      )
    }

    // Get user to check profile type
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Brancher SCG si aucun score encore
      try {
        const { data: existing } = await supabase
          .from("scg_scores")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle()
        if (!existing) {
          const { aggregateProducerData } = await import("@/lib/scg/aggregate")
          const { calculateSCG } = await import("@/lib/scg/engine")
          const scgData = await aggregateProducerData(user.id)
          const scg = calculateSCG(scgData)
          await supabase.from("scg_scores").insert({
            user_id: user.id,
            score_total: scg.score_total,
            badge: scg.badge,
            bancable: scg.bancable,
            dim_fiabilite: scg.dimensions.fiabilite,
            dim_qualite: scg.dimensions.qualite,
            dim_engagement: scg.dimensions.engagement,
            dim_volumes: scg.dimensions.volumes,
            dim_stabilite: scg.dimensions.stabilite,
            recommandation: scg.recommandation,
          })
          await supabase
            .from("profiles")
            .update({
              scg_score: scg.score_total,
              scg_badge: scg.badge,
              scg_bancable: scg.bancable,
              scg_calculated_at: scg.calculated_at,
            })
            .eq("id", user.id)
        }
      } catch (scgErr) {
        console.error("[auth/callback] SCG:", scgErr)
      }

      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { path: redirectPath } = await resolvePostAuthRedirect(supabase, user.id)
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // No code or user, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}
