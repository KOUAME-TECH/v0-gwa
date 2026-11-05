import Link from "next/link"
import { preload } from "react-dom"
import type { ShopHeroProduct } from "@/lib/catalog/shop-hero"

function heroSrc(remoteUrl: string) {
  return `/_next/image?url=${encodeURIComponent(remoteUrl)}&w=640&q=75`
}

/** Une seule image, déjà compressée, présente dans le HTML. */
export function ShopHero({ product }: { product: ShopHeroProduct }) {
  const src = heroSrc(product.src)
  preload(src, { as: "image", fetchPriority: "high" })
  return (
    <section className="bg-[#FFF6E5] px-4 pt-3">
      <Link href={`/produit/${product.id}`} className="block overflow-hidden rounded-2xl bg-[#E8E4DC]">
        <img
          src={src}
          alt={product.name}
          width={640}
          height={800}
          fetchPriority="high"
          decoding="async"
          className="h-auto max-h-[70vh] w-full object-cover"
        />
      </Link>
      <p className="mt-2 text-sm font-semibold text-[#111827]">{product.name}</p>
    </section>
  )
}
