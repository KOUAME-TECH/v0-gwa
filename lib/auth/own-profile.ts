import type { SupabaseClient } from "@supabase/supabase-js"

/** Ligne complète du profil connecté. Les colonnes privées ne sont plus lisibles par SELECT direct. */
export async function loadOwnProfile<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
): Promise<T | null> {
  const { data, error } = await supabase.rpc("profile_self")
  if (error || data == null) return null
  if (Array.isArray(data)) return (data[0] as T) ?? null
  return data as T
}
