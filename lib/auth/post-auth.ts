import type { SupabaseClient } from "@supabase/supabase-js"
import {
  USER_TYPE_MAP,
  canonicalProductUserType,
} from "@/lib/auth/dual-identity"

export { USER_TYPE_MAP }

const DASHBOARD_ROUTES: Record<string, string> = {
  producteur: "/dashboard/farmer",
  acheteur: "/dashboard/buyer",
  cooperative: "/dashboard/cooperative",
}

export type AuthDestination = { path: string; isNewUser: boolean }

/**
 * Un compte qui a déjà un rôle et un nom rentre dans son espace.
 * L'absence de `sub_type` ou un profil incomplet ne le renvoie pas
 * à l'onboarding : la plupart des comptes live n'ont pas ce champ.
 */
export function destinationForProfile(input: {
  userType?: string | null
  fullName?: string | null
  isAdmin?: boolean
  fallback?: string
}): AuthDestination {
  const productType = canonicalProductUserType(input.userType)

  if (input.isAdmin && !productType) {
    return { path: "/admin", isNewUser: false }
  }

  if (productType && DASHBOARD_ROUTES[productType]) {
    if (!input.fullName?.trim()) {
      return { path: "/auth/signup?resume=onboarding", isNewUser: true }
    }
    return { path: DASHBOARD_ROUTES[productType], isNewUser: false }
  }

  return { path: "/auth/onboarding", isNewUser: true }
}

/**
 * Destination après login / OTP.
 *
 * Double identité (admin_roles + user_type métier) :
 * on ouvre l’espace produit, pas le backoffice — le backoffice reste
 * accessible via « Backoffice admin » / bannière Mode admin.
 * Staff sans compte produit → /admin.
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string,
  fallback = "/profil",
): Promise<{ path: string; isNewUser: boolean }> {
  const [{ data: adminRole }, { data: profile }] = await Promise.all([
    supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("user_type, full_name, profile_completion_pct, country, city, sub_type")
      .eq("id", userId)
      .maybeSingle(),
  ])

  return destinationForProfile({
    userType: profile?.user_type,
    fullName: profile?.full_name,
    isAdmin: Boolean(adminRole),
    fallback,
  })
}

export function computeProfileCompletion(profile: {
  full_name?: string | null
  user_type?: string | null
  country?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
}): number {
  const fields = [
    profile.full_name,
    profile.user_type,
    profile.country,
    profile.city,
    profile.phone || profile.email,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}
