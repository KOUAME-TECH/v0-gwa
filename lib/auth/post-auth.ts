import type { SupabaseClient } from "@supabase/supabase-js"
import {
  USER_TYPE_MAP,
  hasProductAccount,
  canonicalProductUserType,
} from "@/lib/auth/dual-identity"

export { USER_TYPE_MAP }

const DASHBOARD_ROUTES: Record<string, string> = {
  producteur: "/dashboard/farmer",
  acheteur: "/dashboard/buyer",
  cooperative: "/dashboard/cooperative",
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

  const productType = canonicalProductUserType(profile?.user_type)
  const productAccount = hasProductAccount(profile?.user_type)

  // Staff-only : pas de compte métier → backoffice
  if (adminRole && !productAccount) {
    return { path: "/admin", isNewUser: false }
  }

  if (!profile?.sub_type) {
    return { path: "/auth/onboarding", isNewUser: true }
  }

  const completion = profile?.profile_completion_pct ?? 0
  const isNewUser =
    !profile?.full_name ||
    completion < 50 ||
    !profile?.country

  if (isNewUser) {
    return { path: "/auth/signup?resume=onboarding", isNewUser: true }
  }

  if (productType && DASHBOARD_ROUTES[productType]) {
    return {
      path: DASHBOARD_ROUTES[productType],
      isNewUser: false,
    }
  }

  if (adminRole) {
    return { path: "/admin", isNewUser: false }
  }

  return {
    path: fallback,
    isNewUser: false,
  }
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
