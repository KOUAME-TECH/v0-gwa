/** Texte TTS pour un produit (accessibilité — utilisateurs qui ne lisent pas). */

export type ProductListenInput = {
  name: string
  price: number
  unit: string
  description?: string | null
  origin_region?: string | null
  origin_country?: string | null
  product_type?: string | null
  is_organic?: boolean | null
}

function formatPriceFr(price: number): string {
  return new Intl.NumberFormat("fr-FR").format(price)
}

/** Phrase naturelle pour synthèse vocale ou affichage « écouter ». */
export function buildProductListenText(product: ProductListenInput): string {
  const parts: string[] = []

  parts.push(product.name)
  parts.push(`${formatPriceFr(product.price)} francs CFA le ${product.unit || "kilogramme"}`)

  if (product.description?.trim()) {
    parts.push(product.description.trim())
  }

  const origin = product.origin_region || product.origin_country
  if (origin?.trim()) {
    parts.push(`Origine ${origin.trim()}`)
  }

  if (product.product_type?.trim()) {
    parts.push(`Catégorie ${product.product_type.replace(/_/g, " ")}`)
  }

  if (product.is_organic) {
    parts.push("Produit biologique")
  }

  return parts.join(". ")
}
