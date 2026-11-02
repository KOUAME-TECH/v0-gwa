import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

type Props = { params: Promise<{ id: string }> }

async function loadProductMeta(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !id) return null
  try {
    const supabase = createClient(url, key)
    const { data } = await supabase
      .from("products")
      .select("id, name, description, price, unit, images, status")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle()
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await loadProductMeta(id)
  if (!product) {
    return {
      title: "Produit",
      robots: { index: false, follow: true },
    }
  }
  const desc =
    (product.description || "").trim().slice(0, 155) ||
    `${product.name} — ${product.price} FCFA/${product.unit} sur GWA`
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : []
  return {
    title: product.name,
    description: desc,
    alternates: { canonical: `https://mygwa.org/produit/${product.id}` },
    openGraph: {
      title: `${product.name} | GWA`,
      description: desc,
      url: `https://mygwa.org/produit/${product.id}`,
      type: "website",
      ...(images[0] ? { images: [{ url: images[0], alt: product.name }] } : {}),
    },
  }
}

export default function ProduitLayout({ children }: { children: React.ReactNode }) {
  return children
}
