/**
 * Chemins produit — source unique pour éviter les divergences Moi / marketplace / dashboard.
 */
export function productDetailPath(productId: string): string {
  const id = productId?.trim()
  if (!id) return "/agriculture"
  return `/produit/${id}`
}

export function productEditPath(productId: string): string {
  const id = productId?.trim()
  if (!id) return "/dashboard/products"
  return `/dashboard/products/${id}/edit`
}
