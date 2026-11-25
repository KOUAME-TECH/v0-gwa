import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Champs privilégiés de `profiles` (migration 086) : un membre ne peut ni les poser
 * à l'INSERT ni les modifier à l'UPDATE avec sa propre session. Seul le serveur
 * (service role) les écrit, après contrôle. Liste identique au trigger SQL
 * `protect_profile_privileged_fields`.
 */
export const PRIVILEGED_PROFILE_FIELDS = [
  // rôle
  "user_type",
  "sub_type",
  "coop_id",
  // identité / KYC
  "is_verified",
  "rccm_verified",
  "phone",
  "phone_verified",
  "phone_linked_at",
  "email_linked_at",
  // suspension
  "is_suspended",
  "suspended_reason",
  "suspended_at",
  "suspended_by",
  // abonnement / tarif
  "subscription_tier",
  "subscription_expires_at",
  "pricing_plan_id",
  // réputation
  "rating",
  "total_reviews",
  // Score de Confiance
  "scg_score",
  "scg_badge",
  "scg_bancable",
  "scg_calculated_at",
  "scg_criteria",
  // système
  "created_at",
  "digest_last_sent_at",
] as const

export type PrivilegedProfileField = (typeof PRIVILEGED_PROFILE_FIELDS)[number]

export type SelfRoleChoice = { user_type?: unknown; sub_type?: unknown }
type Role = { user_type: string; sub_type: string | null }

/**
 * Choix de rôle autorisé en libre-service (inscription / onboarding) :
 * - acheteur ou producteur tant que le sous-type n'est pas choisi ;
 * - sous-type producteur_individuel → producteur ; cooperative → cooperative.
 * Une fois le sous-type posé, le rôle est figé (changement via le support / admin).
 */
export function normalizeSelfRole(input: SelfRoleChoice): Role | { error: string } {
  const ut = typeof input.user_type === "string" ? input.user_type : undefined
  const st = typeof input.sub_type === "string" ? input.sub_type : undefined
  if (st === "producteur_individuel" && (ut === undefined || ut === "producteur")) {
    return { user_type: "producteur", sub_type: st }
  }
  if (st === "cooperative" && (ut === undefined || ut === "cooperative")) {
    return { user_type: "cooperative", sub_type: st }
  }
  if (st === undefined && (ut === "acheteur" || ut === "producteur")) {
    return { user_type: ut, sub_type: null }
  }
  return { error: "Rôle invalide" }
}

export async function applySelfRoleChoice(
  userId: string,
  input: SelfRoleChoice,
  admin: SupabaseClient = createAdminClient(),
): Promise<{ ok: true; changed: boolean } | { error: string; status: number }> {
  const role = normalizeSelfRole(input)
  if ("error" in role) return { error: role.error, status: 400 }

  const { data: current, error: readErr } = await admin
    .from("profiles")
    .select("user_type, sub_type")
    .eq("id", userId)
    .maybeSingle()
  if (readErr || !current) return { error: "Profil introuvable", status: 404 }

  if (current.sub_type) {
    const same = current.sub_type === (role.sub_type ?? current.sub_type) && current.user_type === role.user_type
    return same
      ? { ok: true, changed: false }
      : { error: "Ton rôle est déjà choisi. Contacte le support pour le changer.", status: 409 }
  }

  const patch: Record<string, unknown> = { user_type: role.user_type, updated_at: new Date().toISOString() }
  if (role.sub_type) patch.sub_type = role.sub_type
  const { error } = await admin.from("profiles").update(patch).eq("id", userId)
  if (error) return { error: "Enregistrement du rôle impossible", status: 500 }
  return { ok: true, changed: true }
}
