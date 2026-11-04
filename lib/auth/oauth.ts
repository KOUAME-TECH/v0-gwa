/**
 * Helpers OAuth (Google) — PKCE + redirect vers /auth/callback.
 * Ne contient aucun secret ; le Client Secret reste côté Supabase Dashboard.
 */

export function safeOAuthNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  let value = next.trim()
  if (!value) return null
  try {
    value = decodeURIComponent(value)
  } catch {
    return null
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  if (value.includes("\\") || value.includes("://") || value.includes("\0")) return null
  if (value.includes("//")) return null
  return value
}

/**
 * URL de retour après le provider Google (via GoTrue).
 * Doit être listée dans Supabase Auth → Redirect URLs.
 */
export function buildGoogleOAuthRedirectTo(
  origin: string,
  next?: string | null,
): string {
  const base = origin.replace(/\/$/, "")
  const safeNext = safeOAuthNextPath(next ?? null)
  if (!safeNext) return `${base}/auth/callback`
  return `${base}/auth/callback?next=${encodeURIComponent(safeNext)}`
}
