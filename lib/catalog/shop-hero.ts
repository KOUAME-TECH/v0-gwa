import { createClient } from "@supabase/supabase-js"

export type ShopHeroProduct = {
  id: string
  name: string
  src: string
}

/** Première photo réelle de la boutique, lue avant le JavaScript. */
export async function getShopHero(): Promise<ShopHeroProduct | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase
      .from("products")
      .select("id, name, images")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(12)
    if (error || !data) return null
    for (const row of data) {
      const images = Array.isArray(row.images) ? row.images : []
      const src = images.find((value) => typeof value === "string" && value.startsWith("https://"))
      if (typeof src === "string" && row.id && row.name) {
        return { id: String(row.id), name: String(row.name), src }
      }
    }
  } catch (err) {
    console.error("[shop-hero]", err)
  }
  return null
}
