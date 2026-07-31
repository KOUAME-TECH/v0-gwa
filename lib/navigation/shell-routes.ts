/**
 * Bottom nav (mobile) + top nav (desktop) = shell principal.
 * Inclut dashboards / wallet / abo pour éviter les écrans « orphelins ».
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
  "/aide",
  "/wallet",
  "/abonnement",
  "/scg",
  "/affacturage",
  "/dashboard",
  "/dashboard/buyer",
  "/dashboard/farmer",
  "/dashboard/cooperative",
  "/dashboard/commandes",
  "/dashboard/products",
  "/dashboard/reviews",
])

const PREFIXES = [
  "/marketplace/",
  "/agriculture/",
  "/recherche/",
  "/produit/",
  "/post/",
  "/profil/",
  "/wallet/",
  "/dashboard/commandes",
  "/dashboard/products",
  "/dashboard/buyer",
  "/dashboard/farmer",
  "/dashboard/cooperative",
  "/dashboard/reviews",
] as const

function isShellPath(pathname: string): boolean {
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/messages/") ||
    pathname.startsWith("/profil/edit") ||
    pathname.startsWith("/profil/lier") ||
    pathname.startsWith("/profil/verification") ||
    pathname.startsWith("/cooperatives") ||
    pathname.startsWith("/conditions") ||
    pathname.startsWith("/confidentialite") ||
    pathname.startsWith("/download") ||
    pathname.startsWith("/contact") ||
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

/** Bottom tabs — mobile / tablette portrait. */
export function shouldShowBottomNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return isShellPath(pathname)
}

/** Top bar — desktop / tablette large (même périmètre shell). */
export function shouldShowDesktopNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return isShellPath(pathname)
}
