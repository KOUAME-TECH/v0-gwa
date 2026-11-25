import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SCGResult } from "@/lib/scg/engine"
import { SCG_MODEL_VERSION } from "@/lib/scg/five-c"

/**
 * Seule voie d'écriture du SCG (migration 084) : service role, côté serveur.
 * `scg_scores`, `scg_history` (via le trigger) et les colonnes `profiles.scg_*`
 * ne sont plus modifiables par `anon` ni `authenticated`.
 * Le score vient toujours du moteur (`calculateSCG`), jamais du client.
 */
export async function persistScgResult(
  userId: string,
  result: SCGResult,
  admin: SupabaseClient = createAdminClient(),
): Promise<void> {
  const { error: insertError } = await admin.from("scg_scores").insert({
    user_id: userId,
    score_total: result.score_total,
    badge: result.badge,
    bancable: result.bancable,
    model_version: result.explain?.model_version ?? SCG_MODEL_VERSION,
    c_character: result.dimensions.character,
    c_capacity: result.dimensions.capacity,
    c_capital: result.dimensions.capital,
    c_collateral: result.dimensions.collateral,
    c_conditions: result.dimensions.conditions,
    explain: {
      top_up: result.explain?.top_up ?? [],
      top_down: result.explain?.top_down ?? [],
      caps: result.explain?.caps ?? [],
      flags: result.explain?.flags ?? [],
      factors: result.explain?.factors ?? [],
    },
    recommandation: result.recommandation,
  })
  if (insertError) throw new Error(`scg_scores: ${insertError.message}`)

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      scg_score: result.score_total,
      scg_badge: result.badge,
      scg_bancable: result.bancable,
      scg_calculated_at: result.calculated_at,
      scg_criteria: { model: result.explain?.model_version ?? SCG_MODEL_VERSION, ...result.dimensions },
    })
    .eq("id", userId)
  if (profileError) throw new Error(`profiles.scg: ${profileError.message}`)
}

/** Premier calcul si l'utilisateur n'a encore aucun score (connexion OTP / OAuth). */
export async function ensureInitialScg(
  userId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<boolean> {
  const { data: existing } = await admin
    .from("scg_scores")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (existing) return false
  const { aggregateProducerData } = await import("@/lib/scg/aggregate")
  const { calculateSCG } = await import("@/lib/scg/engine")
  const result = calculateSCG(await aggregateProducerData(userId, admin))
  await persistScgResult(userId, result, admin)
  return true
}
