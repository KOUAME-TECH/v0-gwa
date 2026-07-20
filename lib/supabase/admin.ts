import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Client admin (service role) — API routes serveur uniquement.
 * Ne jamais exposer côté navigateur.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante")
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
