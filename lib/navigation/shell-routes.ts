/**
 * Bottom nav = shell principal (onglets natifs).
 * Masquée hors parcours principaux.
 */

const EXACT = new Set([
  "/",
  "/marketplace",
  "/agriculture",
  "/recherche",
  "/messages",
  "/profil",
  "/notifications",
  "/panier",
  "/favoris",
  "/publier",
])

const PREFIXES = [
  "/marketplace/",
  "/agriculture/",
  "/recherche/",
  "/produit/",
  "/post/",
  "/profil/",
] as const

export function shouldShowBottomNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/profil/edit") ||
    pathname.startsWith("/cooperatives") ||
    pathname.startsWith("/conditions") ||
    pathname.startsWith("/confidentialite") ||
    pathname.startsWith("/download") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/scg") ||
    pathname.startsWith("/affacturage") ||
    pathname.startsWith("/commandes") ||
    pathname.startsWith("/facture") ||
    pathname.startsWith("/dev") ||
    pathname.startsWith("/legal")
  ) {
    return false
  }

  if (EXACT.has(pathname)) return true
  return PREFIXES.some((p) => pathname.startsWith(p))
}
