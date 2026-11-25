/**
 * Matrice d'accès back-office GWA — rôles stockés dans admin_roles.role
 */
export type AdminRole = "super_admin" | "finance_admin" | "admin" | "moderator" | "support"

export type AdminSection =
  | "dashboard"
  | "users"
  | "products"
  | "orders"
  | "cooperatives"
  | "reports"
  | "disputes"
  | "verifications"
  | "scg"
  | "finances"
  | "factoring"
  | "subscriptions"
  | "ai"
  | "analytics"
  | "settings"
  | "support"
  | "pricing"
  | "features"

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super administrateur",
  finance_admin: "Responsable financier",
  admin: "Administrateur",
  moderator: "Modérateur",
  support: "Support",
}

/** Chemins sidebar → section logique */
export const ADMIN_NAV: { name: string; href: string; section: AdminSection }[] = [
  { name: "Dashboard", href: "/admin", section: "dashboard" },
  { name: "Utilisateurs", href: "/admin/users", section: "users" },
  { name: "Produits", href: "/admin/products", section: "products" },
  { name: "Commandes", href: "/admin/orders", section: "orders" },
  { name: "Cooperatives", href: "/admin/cooperatives", section: "cooperatives" },
  { name: "Signalements", href: "/admin/reports", section: "reports" },
  { name: "Support", href: "/admin/support", section: "support" },
  { name: "Litiges", href: "/admin/disputes", section: "disputes" },
  { name: "Vérification", href: "/admin/verifications", section: "verifications" },
  { name: "SCG Config", href: "/admin/scg", section: "scg" },
  { name: "Finances", href: "/admin/finances", section: "finances" },
  { name: "Affacturage", href: "/admin/factoring", section: "factoring" },
  { name: "Abonnements", href: "/admin/subscriptions", section: "subscriptions" },
  { name: "Tarifs", href: "/admin/pricing", section: "pricing" },
  { name: "Yelly Ops", href: "/admin/ai", section: "ai" },
  { name: "Statistiques", href: "/admin/analytics", section: "analytics" },
  { name: "Parametres", href: "/admin/settings", section: "settings" },
  { name: "Fonctionnalités", href: "/admin/features", section: "features" },
]

const ALL_SECTIONS: AdminSection[] = ADMIN_NAV.map((n) => n.section)

const ROLE_SECTIONS: Record<AdminRole, AdminSection[]> = {
  super_admin: ALL_SECTIONS,
  finance_admin: ["dashboard", "finances", "pricing", "settings", "orders", "subscriptions"],
  admin: ALL_SECTIONS,
  support: [
    "dashboard",
    "users",
    "orders",
    "reports",
    "support",
    "disputes",
    "verifications",
    "factoring",
    "subscriptions",
    "ai",
  ],
  moderator: ["dashboard", "products", "reports", "support", "ai"],
}

export type AdminAction =
  | "verify"
  | "unverify"
  | "suspend"
  | "unsuspend"
  | "verification_approve"
  | "verification_reject"
  | "factoring_approve"
  | "factoring_reject"
  | "factoring_disburse"
  | "export_users"
  | "export_orders"
  | "export_products"
  | "export_factoring"
  | "grant_support"
  | "grant_admin"
  | "revoke_admin"

/** Bascule des feature flags : super_admin et admin uniquement. */
export function canToggleFeatureFlags(role: AdminRole): boolean {
  return role === "super_admin" || role === "admin"
}

/** Drapeaux réglementés (wallet = agrément BCEAO) : super_admin uniquement. */
export const SUPER_ADMIN_ONLY_FLAGS: readonly string[] = ["wallet", "internal_wallet"]

export function canToggleFeatureFlag(role: AdminRole, flag: string): boolean {
  if (!canToggleFeatureFlags(role)) return false
  if (SUPER_ADMIN_ONLY_FLAGS.includes(flag)) return role === "super_admin"
  return true
}

export function canEditCommercialSettings(role: AdminRole): boolean {
  return role === "super_admin" || role === "finance_admin"
}

const ROLE_ACTIONS: Record<AdminRole, AdminAction[]> = {
  super_admin: [
    "verify",
    "unverify",
    "suspend",
    "unsuspend",
    "verification_approve",
    "verification_reject",
    "factoring_approve",
    "factoring_reject",
    "factoring_disburse",
    "export_users",
    "export_orders",
    "export_products",
    "export_factoring",
    "grant_support",
    "grant_admin",
    "revoke_admin",
  ],
  finance_admin: ["export_orders"],
  admin: [
    "verify",
    "unverify",
    "suspend",
    "unsuspend",
    "verification_approve",
    "verification_reject",
    "factoring_approve",
    "factoring_reject",
    "factoring_disburse",
    "export_users",
    "export_orders",
    "export_products",
    "export_factoring",
  ],
  support: [
    "verify",
    "unverify",
    "suspend",
    "unsuspend",
    "verification_approve",
    "verification_reject",
    "factoring_approve",
    "factoring_reject",
    "export_users",
    "export_orders",
  ],
  moderator: ["export_products"],
}

export const DEFAULT_SUPPORT_PERMISSIONS = {
  users: { read: true, verify: true, suspend: true },
  verifications: { read: true, write: true },
  disputes: { read: true, write: true },
  reports: { read: true, write: true },
  orders: { read: true },
  factoring: { read: true, approve: true, reject: true, disburse: false },
}

export const DEFAULT_ADMIN_PERMISSIONS = { all: true }

export function isAdminRole(value: string | null | undefined): value is AdminRole {
  return (
    value === "super_admin" ||
    value === "finance_admin" ||
    value === "admin" ||
    value === "moderator" ||
    value === "support"
  )
}

export function canAccessSection(role: AdminRole, section: AdminSection): boolean {
  return ROLE_SECTIONS[role]?.includes(section) ?? false
}

export function canPerformAdminAction(role: AdminRole, action: AdminAction): boolean {
  return ROLE_ACTIONS[role]?.includes(action) ?? false
}

export function isSuperAdmin(role: AdminRole): boolean {
  return role === "super_admin"
}

/** Section déduite d'un pathname /admin/... */
export function sectionFromPath(pathname: string): AdminSection {
  const match = ADMIN_NAV.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)),
  )
  return match?.section ?? "dashboard"
}

export function filterNavForRole(role: AdminRole) {
  return ADMIN_NAV.filter((item) => canAccessSection(role, item.section))
}
