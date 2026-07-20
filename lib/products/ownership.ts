/**
 * GWA — Contrôle de propriété produit + soft-delete.
 *
 * Point 7 : seul le vendeur (seller_id) peut modifier/supprimer son offre.
 * La suppression est un soft-delete (status = 'archived') pour préserver
 * l'historique des commandes et l'audit.
 */

export interface OwnableProduct {
  seller_id?: string | null
}

export function canModifyProduct(
  product: OwnableProduct | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!product || !userId) return false
  return product.seller_id === userId
}

/** Payload appliqué lors d'un soft-delete produit. */
export function softDeleteProductPatch(): { status: string; offer_status: string } {
  return { status: "archived", offer_status: "archived" }
}

/** Un produit archivé ne doit plus apparaître dans les listes actives. */
export function isArchived(product: { status?: string | null } | null | undefined): boolean {
  return product?.status === "archived"
}
