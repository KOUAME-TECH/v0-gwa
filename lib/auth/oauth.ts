/**
 * Helpers OAuth (Google) — PKCE + redirect vers /auth/callback.
 * Ne contient aucun secret ; le Client Secret reste côté Supabase Dashboard.
 */

export function safeOAuthNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  const value = next.trim()
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("\\") || value.includes("://")) return null
  return value
}

/** Chemin interne après connexion. Refuse les boucles vers l'écran de login. */
export function safeInternalPath(next: string | null | undefined): string | null {
  const value = safeOAuthNextPath(next)
  if (!value) return null
  const pathOnly = value.split("?")[0] || value
  if (
    pathOnly === "/auth/login" ||
    pathOnly.startsWith("/auth/login/") ||
    pathOnly === "/auth/error" ||
    pathOnly.startsWith("/auth/callback")
  ) {
    return null
  }
  return value
}

export function loginHref(next: string): string {
  const safe = safeInternalPath(next) || "/profil"
  return `/auth/login?redirect=${encodeURIComponent(safe)}`
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
