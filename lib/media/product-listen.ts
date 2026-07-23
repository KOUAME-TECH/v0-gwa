/** Texte TTS naturel pour un produit (phrases fluides, pauses à la voix). */

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

function unitSpoken(unit?: string | null): string {
  const u = (unit || "kg").toLowerCase().trim()
  if (u === "kg" || u === "kilogramme" || u === "kilo") return "le kilo"
  if (u === "g" || u === "gramme") return "le gramme"
  if (u === "l" || u === "litre") return "le litre"
  if (u === "sac" || u === "sacs") return "le sac"
  if (u === "pièce" || u === "piece" || u === "pce") return "la pièce"
  if (u === "botte" || u === "bottes") return "la botte"
  return `le ${u}`
}

function softenDescription(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ")
  if (t.length <= 160) return t
  const cut = t.slice(0, 157)
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf(","), cut.lastIndexOf(" "))
  return `${(last > 40 ? cut.slice(0, last) : cut).trim()}…`
}

/**
 * Phrase naturelle pour synthèse vocale.
 * Points et virgules = pauses TTS (voix plus humaine, moins robot).
 */
export function buildProductListenText(product: ProductListenInput): string {
  const name = product.name?.trim() || "Produit"
  const price = formatPriceFr(product.price)
  const unit = unitSpoken(product.unit)

  const chunks: string[] = []
  chunks.push(`Voici ${name}.`)
  chunks.push(`Il est à ${price} francs CFA, ${unit}.`)

  if (product.description?.trim()) {
    chunks.push(softenDescription(product.description))
  }

  const origin = product.origin_region || product.origin_country
  if (origin?.trim()) {
    chunks.push(`Il vient de ${origin.trim()}.`)
  }

  if (product.is_organic) {
    chunks.push("C'est un produit biologique.")
  }

  return chunks.join(" ")
}
