/**
 * Routes qui exigent une session côté serveur (proxy.ts → updateSession).
 * Un visiteur anonyme reçoit une redirection 307 vers /auth/login?redirect=…
 *
 * `/profil` seul (l'espace « Moi ») et ses sous-pages personnelles sont protégés ;
 * le profil public d'un autre membre (`/profil/<id>`) reste accessible.
 */
export const PROTECTED_PREFIXES = [
  "/protected",
  "/admin",
  "/dashboard",
  "/publier",
  "/messages",
  "/notifications",
  "/wallet",
  "/payout",
  "/commandes",
  "/abonnement",
  "/scg",
  "/affacturage",
  "/profil/edit",
  "/profil/lier",
  "/profil/verification",
] as const

/** Chemins protégés exactement (sans leurs sous-chemins). */
export const PROTECTED_EXACT_PATHS = ["/profil"] as const

export function isProtectedPath(path: string): boolean {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path
  if ((PROTECTED_EXACT_PATHS as readonly string[]).includes(clean)) return true
  return PROTECTED_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))
}

/** Profil public d'un membre : servi sans lecture de session si aucun cookie. */
export function isPublicProfilePath(path: string): boolean {
  return path.startsWith("/profil/") && !isProtectedPath(path)
}
