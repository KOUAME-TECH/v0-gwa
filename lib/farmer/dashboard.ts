/**
 * Helpers parcours Producteur — dashboard farmer.
 * Source unique pour requêtes ventes + prochaine action UX.
 */

import { ORDER_STATUS_LABELS } from "@/lib/orders/escrow-flow"

export type FarmerNextAction =
  | { kind: "publish"; href: "/publier"; label: string }
  | { kind: "orders"; href: "/dashboard/commandes"; label: string; count: number }
  | { kind: "stock"; href: "/dashboard/products"; label: string; count: number }
  | { kind: "share"; href: "/dashboard/products"; label: string }
  | { kind: "wallet"; href: "/wallet"; label: string }
  | { kind: "kyc"; href: "/profil/verification"; label: string }

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "preparing",
  "shipping",
  "shipped",
])

export function isActiveSellerOrderStatus(status: string | null | undefined): boolean {
  return ACTIVE_ORDER_STATUSES.has(String(status || "").toLowerCase())
}

export function farmerOrderStatusLabel(status: string | null | undefined): string {
  const key = String(status || "").toLowerCase()
  return ORDER_STATUS_LABELS[key] || status || "Statut inconnu"
}

export function resolveFarmerNextAction(input: {
  productCount: number
  pendingOrders: number
  lowStockCount: number
  isVerified?: boolean
  kycPending?: boolean
  availableBalanceFcfa?: number
}): FarmerNextAction {
  if (input.productCount <= 0) {
    return {
      kind: "publish",
      href: "/publier",
      label: "Prochaine étape : publie ta première annonce",
    }
  }
  if (input.pendingOrders > 0) {
    return {
      kind: "orders",
      href: "/dashboard/commandes",
      label: `Prochaine étape : traite ${input.pendingOrders} commande${
        input.pendingOrders > 1 ? "s" : ""
      }`,
      count: input.pendingOrders,
    }
  }
  if (input.lowStockCount > 0) {
    return {
      kind: "stock",
      href: "/dashboard/products",
      label: `Prochaine étape : mets à jour le stock (${input.lowStockCount})`,
      count: input.lowStockCount,
    }
  }
  if ((input.availableBalanceFcfa || 0) >= 1000) {
    return {
      kind: "wallet",
      href: "/wallet",
      label: "Prochaine étape : retire tes gains (portefeuille)",
    }
  }
  if (!input.isVerified && !input.kycPending) {
    return {
      kind: "kyc",
      href: "/profil/verification",
      label: "Prochaine étape : vérifie ton identité (badge)",
    }
  }
  return {
    kind: "share",
    href: "/dashboard/products",
    label: "Prochaine étape : partage ta boutique",
  }
}
