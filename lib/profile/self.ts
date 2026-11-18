import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isTransientNetworkError,
  TRANSIENT_AUTH_RETRY_LIMIT,
} from "@/lib/auth/session-state"

/**
 * Colonnes lisibles par `authenticated` sans GRANT sur le PII.
 * `select('*')` échoue en 42501 (permission denied for table profiles) :
 * l'erreur ne doit jamais être lue comme une absence de session.
 */
export const PROFILE_SAFE_COLUMNS =
  "id, full_name, avatar_url, bio, user_type, city, country, is_verified, rating"

export type OwnProfile = {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  rating: number | null
}

/** Champs réellement affichés par /profil. Email et téléphone n'y figurent pas. */
export type DisplayedProfile = {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
}

export type LoadedOwnProfile = {
  profile: OwnProfile
  /** true si la ligne complète (profile_self) n'a pas pu être lue. */
  partial: boolean
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asRow(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

export function profileFromRow(
  row: Record<string, unknown>,
  user: { id: string; email?: string | null },
): OwnProfile {
  return {
    id: text(row.id) ?? user.id,
    full_name: text(row.full_name) ?? "Utilisateur GWA",
    avatar_url: text(row.avatar_url),
    bio: text(row.bio),
    user_type: text(row.user_type),
    city: text(row.city),
    country: text(row.country),
    is_verified: row.is_verified === true,
    rating: typeof row.rating === "number" ? row.rating : null,
  }
}

export function toDisplayedProfile(profile: OwnProfile): DisplayedProfile {
  return {
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    user_type: profile.user_type,
    city: profile.city,
    country: profile.country,
    is_verified: profile.is_verified,
  }
}

export function profileFromAuthUser(user: {
  id: string
  email?: string | null
}): OwnProfile {
  return profileFromRow({}, user)
}

/**
 * Profil du compte connecté.
 * 1. `profile_self()` (SECURITY DEFINER) lit la ligne du `auth.uid()`.
 *    Email et téléphone de la ligne ne sont pas recopiés.
 * 2. Sinon, colonnes publiques explicitement accordées.
 * 3. Sinon, identité auth minimale : l'utilisateur reste connecté.
 * Un timeout est retenté au plus TRANSIENT_AUTH_RETRY_LIMIT fois.
 */
export async function loadOwnProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<LoadedOwnProfile> {
  let rpc = await supabase.rpc("profile_self")
  for (
    let attempt = 0;
    rpc.error &&
    isTransientNetworkError(rpc.error) &&
    attempt < TRANSIENT_AUTH_RETRY_LIMIT;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    rpc = await supabase.rpc("profile_self")
  }
  const rpcRow = rpc.error ? null : asRow(rpc.data)
  if (rpcRow) {
    return { profile: profileFromRow(rpcRow, user), partial: false }
  }

  const fallback = await supabase
    .from("profiles")
    .select(PROFILE_SAFE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle()

  if (fallback.data && typeof fallback.data === "object") {
    return {
      profile: profileFromRow(fallback.data as Record<string, unknown>, user),
      partial: true,
    }
  }

  return { profile: profileFromAuthUser(user), partial: true }
}
