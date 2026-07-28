import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

const cache = new Map<string, { value: string; at: number }>()
const TTL_MS = 60_000

/**
 * Lit un secret ops : env Vercel d’abord, sinon platform_secrets (service_role).
 * Ne jamais exposer au client.
 */
export async function resolvePlatformSecret(
  key: string,
  envFallbacks: string[] = [],
): Promise<string> {
  for (const envKey of [key, ...envFallbacks]) {
    const fromEnv = (process.env[envKey] || "").trim()
    if (fromEnv) return fromEnv
  }

  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.value
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("platform_secrets")
      .select("value")
      .eq("key", key)
      .maybeSingle()
    if (error || !data?.value) return ""
    const value = String(data.value).trim()
    if (value) cache.set(key, { value, at: Date.now() })
    return value
  } catch (err) {
    console.error("[platform-secrets]", key, err)
    return ""
  }
}

export async function hasPlatformSecret(
  key: string,
  envFallbacks: string[] = [],
): Promise<boolean> {
  const v = await resolvePlatformSecret(key, envFallbacks)
  return Boolean(v)
}
