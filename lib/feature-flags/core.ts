/**
 * Drapeaux de fonctionnalité — lecture fail-closed (GSAC-2).
 *
 * Table de prod : public.feature_flags(name, is_active_public, is_active_beta, description)
 * (créée par 071, lecture anon/authenticated via la policy feature_flags_read).
 *
 * Règle : toute erreur (table absente, ligne absente, réseau, env manquante,
 * timeout) renvoie `false`. Le wallet reste donc masqué tant que la ligne
 * `wallet` n'est pas explicitement activée.
 *
 * Module sans dépendance Node/serveur : utilisable dans le proxy (middleware),
 * les route handlers et les server components.
 */

export const WALLET_FLAG = "wallet" as const

/** Clés gérées par le back-office. Toute autre clé est refusée en écriture. */
export const KNOWN_FEATURE_FLAGS = [
  WALLET_FLAG,
  "internal_wallet",
  "buyer_subscription",
  "rfq_aggregation",
  "factoring",
  "video_calls",
  "eudr_tracking",
] as const

export type FeatureFlagKey = (typeof KNOWN_FEATURE_FLAGS)[number]

export const FEATURE_FLAG_CACHE_TTL_MS = 30_000
const FETCH_TIMEOUT_MS = 1_500

type CacheEntry = { enabled: boolean; expiresAt: number }
const cache = new Map<string, CacheEntry>()

export function clearFeatureFlagCache() {
  cache.clear()
}

export type FetchFeatureFlagOptions = {
  fetchImpl?: typeof fetch
  supabaseUrl?: string
  anonKey?: string
  now?: number
  /** Ignore le cache mémoire (back-office, tests). */
  noCache?: boolean
}

/** Interprète la réponse PostgREST : seul `is_active_public === true` active. */
export function resolveFlagRows(rows: unknown): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const row = rows[0] as { is_active_public?: unknown } | null
  return row?.is_active_public === true
}

/**
 * Lit un drapeau via l'API REST Supabase (clé publique, RLS lecture).
 * Fail-closed : renvoie false sur toute anomalie.
 */
export async function fetchFeatureFlag(
  key: string,
  options: FetchFeatureFlagOptions = {},
): Promise<boolean> {
  const now = options.now ?? Date.now()
  if (!options.noCache) {
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now) return hit.enabled
  }

  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    options.anonKey ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  let enabled = false
  if (supabaseUrl && anonKey && typeof fetchImpl === "function") {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null
    try {
      const url =
        `${supabaseUrl.replace(/\/$/, "")}/rest/v1/feature_flags` +
        `?select=is_active_public&name=eq.${encodeURIComponent(key)}&limit=1`
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller?.signal,
      })
      enabled = res.ok ? resolveFlagRows(await res.json()) : false
    } catch {
      enabled = false
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  cache.set(key, { enabled, expiresAt: now + FEATURE_FLAG_CACHE_TTL_MS })
  return enabled
}

/** Portée wallet d'un chemin : page utilisateur, API, ou hors wallet. */
export function walletPathScope(pathname: string): "page" | "api" | null {
  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  if (matches("/api/wallet") || matches("/api/payout")) return "api"
  if (matches("/wallet") || matches("/payout")) return "page"
  return null
}

/** Destination quand une page wallet est masquée. */
export const WALLET_DISABLED_REDIRECT = "/dashboard"
