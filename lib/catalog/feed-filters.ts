/**
 * Filtres catalogue / feed — slugs cohérents avec `categories.slug` (pas product_type).
 * Pas d'emojis : libellés texte uniquement.
 */

export type FeedFilterChip = {
  id: string
  name: string
  /** Slugs `categories` acceptés (exact ou préfixe) */
  match: string[]
}

/** Chips feed / agriculture — alignés sur les vraies catégories agri. */
export const FEED_FILTER_CHIPS: FeedFilterChip[] = [
  { id: "all", name: "Tout", match: [] },
  { id: "cereales", name: "Céréales", match: ["cereales", "riz", "mais", "mil-sorgho", "legumineuses"] },
  { id: "cacao", name: "Cacao", match: ["cacao", "cacao-cafe"] },
  { id: "cafe", name: "Café", match: ["cafe", "cacao-cafe"] },
  { id: "fruits", name: "Fruits", match: ["fruits", "fruits-tropicaux", "fruits-secs", "mangues", "bananes", "ananas", "agrumes"] },
  { id: "legumes", name: "Légumes", match: ["legumes", "legumes-feuilles", "legumes-fruits", "legumes-racines", "tubercules"] },
  { id: "epices", name: "Épices", match: ["epices", "plantes-aromatiques"] },
  { id: "elevage", name: "Élevage", match: ["elevage", "bovins", "ovins-caprins", "porcins", "volailles", "oeufs", "produits-laitiers", "aquaculture", "apiculture"] },
]

function normalizeSlug(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
}

/** True si le produit matche le chip (slug catégorie / nom). */
export function productMatchesFeedFilter(
  chipId: string,
  opts: {
    categorySlug?: string | null
    categoryName?: string | null
    productName?: string | null
  },
): boolean {
  if (chipId === "all") return true
  const chip = FEED_FILTER_CHIPS.find((c) => c.id === chipId)
  if (!chip) return true

  const slug = normalizeSlug(opts.categorySlug)
  const name = normalizeSlug(opts.categoryName)
  const product = normalizeSlug(opts.productName)

  for (const m of chip.match) {
    const needle = normalizeSlug(m)
    if (!needle) continue
    if (slug === needle || slug.startsWith(`${needle}-`) || slug.includes(needle)) return true
    if (name.includes(needle)) return true
    if (product.includes(needle)) return true
  }
  return false
}
