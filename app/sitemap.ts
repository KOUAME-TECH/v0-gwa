import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://mygwa.org"

const STATIC_PATHS: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]
  priority: number
}> = [
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

async function loadActiveProductIds(): Promise<Array<{ id: string; updated_at?: string | null }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const supabase = createClient(url, key)
    const { data } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(500)
    return data ?? []
  } catch {
    return []
  }
}

/** Sitemap statique + produits actifs (anon RLS). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))

  const products = await loadActiveProductIds()
  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE}/produit/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  return [...staticEntries, ...productEntries]
}
