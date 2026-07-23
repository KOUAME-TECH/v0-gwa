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

function norm(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/** Si city contient une adresse complète, garder le token ville le plus utile. */
function cityToken(raw?: string | null): string {
  const n = norm(raw)
  if (!n) return ""
  // "rue x, cocody, abidjan, cote d'ivoire" → privilégier "abidjan"
  const parts = n.split(/[,/|]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return n
  // Prendre l'avant-dernier segment souvent = ville (avant le pays)
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

/** Correspondance ville/région/pays (insensible à la casse). */
export function matchesUserRegion(product: DigestProduct, profile: DigestProfile): boolean {
  const city = cityToken(profile.city)
  const countries = countryTokens(profile.country)
  if (!city && countries.length === 0) return false

  const geoFields = [
    product.ville,
    product.origin_region,
    product.region,
    product.origin_country,
  ]
    .map(norm)
    .filter(Boolean)

  if (city && geoFields.some((f) => f.includes(city) || city.includes(f))) return true
  if (
    countries.length &&
    geoFields.some((f) => countries.some((c) => f.includes(c) || c.includes(f)))
  ) {
    return true
  }
  return false
}

export function filterDigestProducts(
  products: DigestProduct[],
  profile: DigestProfile,
  since: Date,
): DigestProduct[] {
  const sinceMs = since.getTime()
  return products.filter((p) => {
    const created = new Date(p.created_at).getTime()
    return created >= sinceMs && matchesUserRegion(p, profile)
  })
}

export function digestSinceHours(hours = 24): Date {
  const since = new Date()
  since.setHours(since.getHours() - hours)
  return since
}
