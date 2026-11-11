export type AuthCookie = { name: string; value?: string }

export type SessionKind = "anonymous" | "authenticated" | "unavailable"

type AuthLikeError = {
  message?: string
  name?: string
  status?: number
} | null | undefined

/**
 * Cookie de session posé par @supabase/ssr (`sb-<ref>-auth-token`, y compris les chunks `.0`).
 * Une valeur vide ne compte pas : le navigateur a effacé la session.
 */
export function hasSupabaseAuthCookie(cookies: AuthCookie[]): boolean {
  return cookies.some((cookie) => {
    if (!cookie.value) return false
    return (
      cookie.name.includes("-auth-token") ||
      (cookie.name.startsWith("sb-") && cookie.name.includes("auth"))
    )
  })
}

/** Une seule relance sur timeout ou coupure réseau. Pas de boucle. */
export const TRANSIENT_AUTH_RETRY_LIMIT = 1

const TRANSIENT_HTTP_STATUSES = new Set([408, 502, 503, 504, 522, 524])

/**
 * Timeout ou coupure réseau uniquement.
 * Une 500 Auth durable, ou un message qui contient « abort » sans être
 * un timeout / un échec fetch, ne doit pas empêcher la redirection login.
 */
export function isTransientNetworkError(error: AuthLikeError): boolean {
  if (!error) return false
  if (error.name === "AuthRetryableFetchError") return true
  if (error.status === 0) return true
  if (typeof error.status === "number" && TRANSIENT_HTTP_STATUSES.has(error.status)) {
    return true
  }
  const message = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase()
  return (
    message.includes("authretryablefetcherror") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("econnreset")
  )
}

/**
 * Décision du middleware sur une route protégée : rediriger vers
 * /auth/login. Faux pendant un timeout ou une coupure réseau.
 */
export function shouldRedirectToLogin(input: {
  needsAuth: boolean
  hasUser: boolean
  error: AuthLikeError
}): boolean {
  return input.needsAuth && !input.hasUser && !isTransientNetworkError(input.error)
}

/**
 * Un cookie présent + une panne réseau n'est pas une déconnexion.
 * Sans utilisateur et sans erreur transitoire, la session est absente ou expirée.
 */
export function classifySession(input: {
  hasAuthCookie: boolean
  hasUser: boolean
  transientError: boolean
}): SessionKind {
  if (input.hasUser) return "authenticated"
  if (input.hasAuthCookie && input.transientError) return "unavailable"
  return "anonymous"
}
