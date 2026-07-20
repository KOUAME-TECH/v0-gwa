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
  return (s ?? "").trim().toLowerCase()
}

/** Correspondance ville/région/pays (insensible à la casse). */
export function matchesUserRegion(product: DigestProduct, profile: DigestProfile): boolean {
  const city = norm(profile.city)
  const country = norm(profile.country)
  if (!city && !country) return false

  const geoFields = [product.ville, product.origin_region, product.region, product.origin_country]
    .map(norm)
    .filter(Boolean)

  if (city && geoFields.some((f) => f.includes(city) || city.includes(f))) return true
  if (country && geoFields.some((f) => f.includes(country) || country.includes(f))) return true
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
