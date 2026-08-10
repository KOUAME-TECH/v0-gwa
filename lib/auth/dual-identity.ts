import {
  dashboardPathForUserType,
  type DashboardPath,
} from "@/lib/dashboard/routing"

/** Mapping rôles hérités → 3 rôles métier GWA. */
export const USER_TYPE_MAP: Record<string, string> = {
  farmer: "producteur",
  producteur: "producteur",
  processor: "producteur",
  transformateur: "producteur",
  artisan: "producteur",
  buyer: "acheteur",
  acheteur: "acheteur",
  business: "acheteur",
  entreprise: "acheteur",
  cooperative: "cooperative",
}

/**
 * Types autorisés à l'inscription / OTP client.
 * `cooperative` UNIQUEMENT via POST /api/cooperatives (service_role).
 */
export function safeSelfServeUserType(
  raw: string | null | undefined,
): "acheteur" | "producteur" | undefined {
  if (!raw) return undefined
  const mapped = USER_TYPE_MAP[raw] || raw
  if (mapped === "producteur" || mapped === "acheteur") return mapped
  return undefined
}

const PRODUCT_TYPES = new Set(["producteur", "acheteur", "cooperative"])

/** Type métier canonique (producteur | acheteur | cooperative) ou null. */
export function canonicalProductUserType(
  userType: string | null | undefined,
): "producteur" | "acheteur" | "cooperative" | null {
  if (!userType) return null
  const mapped = USER_TYPE_MAP[userType] || userType
  if (PRODUCT_TYPES.has(mapped)) {
    return mapped as "producteur" | "acheteur" | "cooperative"
  }
  return null
}

/** Compte produit GWA (vendeur / acheteur / coop), distinct du rôle admin_roles. */
export function hasProductAccount(
  userType: string | null | undefined,
): boolean {
  return canonicalProductUserType(userType) != null
}

/** Même session Auth = backoffice + compte métier (cas DG / ops). */
export function isDualIdentity(
  isAdmin: boolean,
  userType: string | null | undefined,
): boolean {
  return Boolean(isAdmin && hasProductAccount(userType))
}

export function productEspaceLabel(
  userType: string | null | undefined,
): string {
  const path = dashboardPathForUserType(userType)
  if (path === "/dashboard/farmer") return "Espace producteur"
  if (path === "/dashboard/cooperative") return "Espace coopérative"
  return "Espace acheteur"
}

export function productEspacePath(
  userType: string | null | undefined,
): DashboardPath {
  return dashboardPathForUserType(userType)
}
