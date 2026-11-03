/** Server-safe JSON-LD injector (no dangerouslySetInnerHTML XSS — values are JSON.stringify'd). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes HTML-breaking sequences in script context when used as text child
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function organizationJsonLd(site = "https://mygwa.org") {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GWA",
    alternateName: "GWA — La Super App Africaine",
    url: site,
    logo: `${site}/icon-512.png`,
    description:
      "Marketplace social africain qui connecte producteurs, coopératives et acheteurs.",
    areaServed: {
      "@type": "Country",
      name: "Côte d'Ivoire",
    },
  }
}

export function websiteJsonLd(site = "https://mygwa.org") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GWA",
    url: site,
    inLanguage: "fr-CI",
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}/recherche?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }
}

export function productJsonLd(input: {
  id: string
  name: string
  description?: string | null
  price: number | string
  unit?: string | null
  images?: string[] | null
  site?: string
}) {
  const site = input.site || "https://mygwa.org"
  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : []
  const price = typeof input.price === "string" ? Number(input.price) : input.price
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description:
      (input.description || "").trim() ||
      `${input.name} — ${price} FCFA${input.unit ? `/${input.unit}` : ""} sur GWA`,
    sku: input.id,
    url: `${site}/produit/${input.id}`,
    ...(images[0] ? { image: images } : {}),
    offers: {
      "@type": "Offer",
      url: `${site}/produit/${input.id}`,
      priceCurrency: "XOF",
      price: Number.isFinite(price) ? price : undefined,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  }
}
