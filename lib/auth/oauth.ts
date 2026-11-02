/**
 * Helpers OAuth (Google) — PKCE + redirect vers /auth/callback.
 * Ne contient aucun secret ; le Client Secret reste côté Supabase Dashboard.
 */

export function safeOAuthNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null
  return next
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
