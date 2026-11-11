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

export function isTransientNetworkError(error: AuthLikeError): boolean {
  if (!error) return false
  const message = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase()
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("aborted") ||
    message.includes("abort") ||
    message.includes("authretryablefetcherror") ||
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    error.status === 408 ||
    error.status === 500 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504 ||
    error.status === 522 ||
    error.status === 524
  )
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
