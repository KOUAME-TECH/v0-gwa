import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Profil du compte connecté.
 * `select` direct sur email / téléphone / adresse est refusé : ces colonnes
 * ne sont lisibles que par `profile_self()`.
 */
export async function loadOwnProfile<T = Record<string, unknown>>(
  supabase: SupabaseClient,
): Promise<T | null> {
  const { data, error } = await supabase.rpc("profile_self")
  if (error || data == null) return null
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null
  return data as T
}
