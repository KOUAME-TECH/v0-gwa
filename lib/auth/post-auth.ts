import type { SupabaseClient } from "@supabase/supabase-js"

// Nouvelle vision GWA (agriculture) : 3 rôles canoniques.
// Les rôles hérités sont mappés vers l'un d'eux.
export const USER_TYPE_MAP: Record<string, string> = {
  // Producteur / vendeur agricole
  farmer: "producteur",
  producteur: "producteur",
  processor: "producteur",
  transformateur: "producteur",
  artisan: "producteur",
  // Acheteur
  buyer: "acheteur",
  acheteur: "acheteur",
  business: "acheteur",
  entreprise: "acheteur",
  // Coopérative
  cooperative: "cooperative",
}

const DASHBOARD_ROUTES: Record<string, string> = {
  producteur: "/dashboard/farmer",
  acheteur: "/dashboard/buyer",
  cooperative: "/dashboard/cooperative",
}

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

  if (adminRole) {
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

  const userType = profile?.user_type
    ? USER_TYPE_MAP[profile.user_type] || profile.user_type
    : null

  return {
    path: (userType && DASHBOARD_ROUTES[userType]) || fallback,
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
