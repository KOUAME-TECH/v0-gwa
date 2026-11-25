/**
 * Liste unique des routes privées (session ou données personnelles).
 * Utilisée par next.config.mjs (Cache-Control private, no-store) et vérifiée
 * par les tests contre le Service Worker (public/gwa-sw-core.js) et le proxy.
 * Fichier .mjs sans dépendance : importable depuis next.config.mjs.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  "/profil",
  "/admin",
  "/dashboard",
  "/wallet",
  "/payout",
  "/messages",
  "/panier",
  "/commandes",
  "/notifications",
  "/publier",
  "/favoris",
  "/facture",
  "/abonnement",
  "/scg",
  "/affacturage",
  "/protected",
  "/auth",
]
