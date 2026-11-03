import type { MetadataRoute } from "next"

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://mygwa.org"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/marketplace", "/recherche", "/agriculture", "/artisans", "/cooperatives", "/aide", "/contact", "/conditions", "/confidentialite", "/download", "/abonnement"],
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/dashboard/",
          "/messages",
          "/panier",
          "/wallet",
          "/profil",
          "/notifications",
          "/publier",
          "/dev/",
          "/facture/",
          "/commandes/",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
