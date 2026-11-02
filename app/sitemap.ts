import type { MetadataRoute } from "next"

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://mygwa.org"

/** Sitemap statique des surfaces indexables (produits dynamiques hors scope RLS anon). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const paths: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; priority: number }> = [
    { path: "/", changeFrequency: "hourly", priority: 1 },
    { path: "/marketplace", changeFrequency: "hourly", priority: 0.95 },
    { path: "/recherche", changeFrequency: "daily", priority: 0.8 },
    { path: "/agriculture", changeFrequency: "daily", priority: 0.75 },
    { path: "/artisans", changeFrequency: "daily", priority: 0.75 },
    { path: "/cooperatives", changeFrequency: "daily", priority: 0.75 },
    { path: "/abonnement", changeFrequency: "weekly", priority: 0.6 },
    { path: "/aide", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/conditions", changeFrequency: "yearly", priority: 0.3 },
    { path: "/confidentialite", changeFrequency: "yearly", priority: 0.3 },
    { path: "/download", changeFrequency: "monthly", priority: 0.4 },
  ]

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
