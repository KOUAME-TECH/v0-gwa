/** Produits régionaux pour Harmattan Digest. */

export type DigestProfile = {
  id: string
  city?: string | null
  country?: string | null
  digest_enabled?: boolean | null
}

export type DigestProduct = {
  id: string
  name: string
  price: number
  unit: string
  description?: string | null
  audio_url?: string | null
  origin_region?: string | null
  origin_country?: string | null
  region?: string | null
  ville?: string | null
  created_at: string
  product_type?: string | null
  is_organic?: boolean | null
  audio_lang?: string | null
}

export type DigestSelection = {
  products: DigestProduct[]
  /** regional_24h | regional_7d | regional_30d | country | newest */
  mode: "regional_24h" | "regional_7d" | "regional_30d" | "country" | "newest"
  since: Date
  /** true = assez récent pour push notification */
  isNotifiable: boolean
}

function norm(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/** Si city contient une adresse complète, garder le token ville le plus utile. */
export function cityToken(raw?: string | null): string {
  const n = norm(raw)
  if (!n) return ""
  const parts = n.split(/[,/|]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return n
  if (parts.length >= 2) return parts[parts.length - 2] || parts[0]
  return parts[0]
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  "cote d'ivoire": ["ci", "ivory coast", "cote divoire", "côte d'ivoire"],
  senegal: ["sn", "sénégal"],
  mali: ["ml"],
  "burkina faso": ["bf"],
  ghana: ["gh"],
  cameroun: ["cm", "cameroon"],
}

function countryTokens(raw?: string | null): string[] {
  const n = norm(raw)
  if (!n) return []
  const out = new Set<string>([n])
  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (n === canonical || aliases.some((a) => norm(a) === n || n.includes(norm(a)))) {
      out.add(canonical)
      aliases.forEach((a) => out.add(norm(a)))
    }
  }
  return [...out]
}

function productGeoFields(product: DigestProduct): string[] {
  return [product.ville, product.origin_region, product.region, product.origin_country]
    .map(norm)
    .filter(Boolean)
}

/** Correspondance ville/région/pays (insensible à la casse). */
export function matchesUserRegion(product: DigestProduct, profile: DigestProfile): boolean {
  const city = cityToken(profile.city)
  const countries = countryTokens(profile.country)
  if (!city && countries.length === 0) return false

  const geoFields = productGeoFields(product)
  if (geoFields.length === 0) return false

  if (city && geoFields.some((f) => f.includes(city) || city.includes(f))) return true
  if (
    countries.length &&
    geoFields.some((f) => countries.some((c) => f.includes(c) || c.includes(f)))
  ) {
    return true
  }
  return false
}

export function matchesUserCountry(product: DigestProduct, profile: DigestProfile): boolean {
  const countries = countryTokens(profile.country)
  if (!countries.length) return false
  const geoFields = productGeoFields(product)
  if (!geoFields.length) return false
  return geoFields.some((f) => countries.some((c) => f.includes(c) || c.includes(f)))
}

function createdMs(p: DigestProduct): number {
  const t = new Date(p.created_at).getTime()
  return Number.isNaN(t) ? 0 : t
}

function newerThan(p: DigestProduct, since: Date): boolean {
  const t = createdMs(p)
  // Produits sans date : garder (catalogue legacy)
  if (!t) return true
  return t >= since.getTime()
}

export function filterDigestProducts(
  products: DigestProduct[],
  profile: DigestProfile,
  since: Date,
): DigestProduct[] {
  return products.filter((p) => newerThan(p, since) && matchesUserRegion(p, profile))
}

/**
 * Sélection robuste du Digest :
 * 24h régional → 7j → 30j → pays → 5 plus récents.
 * Évite un Digest vide quand le catalogue est peu actif.
 */
export function selectDigestProducts(
  products: DigestProduct[],
  profile: DigestProfile,
  limit = 10,
): DigestSelection {
  const sorted = [...products].sort((a, b) => createdMs(b) - createdMs(a))

  const tryRegional = (hours: number, mode: DigestSelection["mode"]): DigestSelection | null => {
    const since = digestSinceHours(hours)
    const matched = sorted
      .filter((p) => newerThan(p, since) && matchesUserRegion(p, profile))
      .slice(0, limit)
    if (matched.length > 0) {
      return {
        products: matched,
        mode,
        since,
        isNotifiable: mode === "regional_24h" || mode === "regional_7d",
      }
    }
    return null
  }

  const hit =
    tryRegional(24, "regional_24h") ||
    tryRegional(24 * 7, "regional_7d") ||
    tryRegional(24 * 30, "regional_30d")

  if (hit) return hit

  const since30 = digestSinceHours(24 * 30)
  const byCountry = sorted
    .filter((p) => newerThan(p, since30) && matchesUserCountry(p, profile))
    .slice(0, limit)
  if (byCountry.length > 0) {
    return { products: byCountry, mode: "country", since: since30, isNotifiable: false }
  }

  const newest = sorted.slice(0, Math.min(limit, 5))
  return {
    products: newest,
    mode: "newest",
    since: digestSinceHours(24 * 365),
    isNotifiable: false,
  }
}

export function digestSinceHours(hours = 24): Date {
  const since = new Date()
  since.setHours(since.getHours() - hours)
  return since
}

export function digestModeLabel(mode: DigestSelection["mode"], city?: string | null): string {
  const place = city?.trim() || "chez vous"
  switch (mode) {
    case "regional_24h":
      return `nouveautés près de ${place}`
    case "regional_7d":
      return `sélection de la semaine près de ${place}`
    case "regional_30d":
      return `sélection du mois près de ${place}`
    case "country":
      return `sélection dans votre pays`
    default:
      return `sélection à écouter`
  }
}
