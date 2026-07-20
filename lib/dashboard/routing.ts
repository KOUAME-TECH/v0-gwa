/**
 * GWA — Mapping rôle → espace (dashboard).
 *
 * DB roles conservés (migration 033) : producteur | acheteur | cooperative
 * (+ admin via admin_roles). On tolère encore les libellés hérités pour ne pas
 * casser d'anciens comptes, mais tout ce qui n'est pas coopérative/acheteur
 * tombe côté producteur (vendeur) sauf acheteur explicite.
 */

export type DashboardPath =
  | "/dashboard/farmer"
  | "/dashboard/buyer"
  | "/dashboard/cooperative"

export function dashboardPathForUserType(
  userType: string | null | undefined,
): DashboardPath {
  switch (userType) {
    case "cooperative":
      return "/dashboard/cooperative"
    case "producteur":
    case "farmer":
    case "processor":
    case "transformateur":
    case "artisan":
      return "/dashboard/farmer"
    case "acheteur":
    case "buyer":
    case "entreprise":
    case "business":
      return "/dashboard/buyer"
    default:
      // Par défaut : acheteur (parcours le plus courant / le moins privilégié).
      return "/dashboard/buyer"
  }
}

/** Rôles considérés comme « vendeurs » (peuvent publier des produits). */
export function isSellerRole(userType: string | null | undefined): boolean {
  return dashboardPathForUserType(userType) !== "/dashboard/buyer"
}
