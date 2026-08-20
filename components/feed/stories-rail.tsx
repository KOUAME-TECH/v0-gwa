"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type StoryItem = {
  id: string
  name: string
  image: string | null
  sellerId: string
  sellerName: string
  sellerAvatar: string | null
  verified: boolean
}

/** Produits déjà chargés par le feed — évite un 2e round-trip catalogue. */
export type StoriesSeedProduct = {
  id: string
  name: string
  images?: string[] | null
  created_at?: string | null
  seller_id?: string
  profiles?: {
    id?: string
    full_name?: string | null
    avatar_url?: string | null
    is_verified?: boolean | null
  } | null
}

function mapSeed(products: StoriesSeedProduct[]): StoryItem[] {
  const since = Date.now() - 24 * 60 * 60 * 1000
  return products
    .filter((p) => {
      if (!p.created_at) return true
      return new Date(p.created_at).getTime() >= since
    })
    .slice(0, 12)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name || ""),
      image: p.images?.[0] || null,
      sellerId: String(p.seller_id || p.profiles?.id || ""),
      sellerName: p.profiles?.full_name || "Vendeur",
      sellerAvatar: p.profiles?.avatar_url || null,
      verified: !!p.profiles?.is_verified,
    }))
}

/**
 * Rail « Aujourd’hui » — offres des dernières 24 h (stories légères sans nouvelle table).
 */
export function StoriesRail({
  className,
  seedProducts,
}: {
  className?: string
  seedProducts?: StoriesSeedProduct[]
}) {
  const [items, setItems] = useState<StoryItem[]>(() =>
    seedProducts?.length ? mapSeed(seedProducts) : [],
  )
  const supabase = createClient()

  useEffect(() => {
    if (seedProducts && seedProducts.length > 0) {
      setItems(mapSeed(seedProducts))
      return
    }

    let cancelled = false
    ;(async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from("products")
        .select(
          `id, name, images, seller_id, created_at,
           profiles!products_seller_id_fkey(id, full_name, avatar_url, is_verified)`,
        )
        .eq("status", "active")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(12)

      if (cancelled || !data) return

      const mapped: StoryItem[] = data.map((p: Record<string, unknown>) => {
        const profile = p.profiles as {
          id?: string
          full_name?: string
          avatar_url?: string | null
          is_verified?: boolean
        } | null
        const images = p.images as string[] | null
        return {
          id: String(p.id),
          name: String(p.name || ""),
          image: images?.[0] || null,
          sellerId: String(p.seller_id || profile?.id || ""),
          sellerName: profile?.full_name || "Vendeur",
          sellerAvatar: profile?.avatar_url || null,
          verified: !!profile?.is_verified,
        }
      })
      setItems(mapped)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, seedProducts])

  if (items.length === 0) return null

  return (
    <section className={cn("px-3 py-2", className)} aria-label="Nouveautés du jour">
      <p className="mb-2 px-1 font-display text-sm text-[#1F5C2E]">
        Aujourd’hui près de toi
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {items.map((s) => (
          <Link
            key={s.id}
            href={`/produit/${s.id}`}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 min-h-11 active:opacity-80"
          >
            <span className="rounded-full bg-gradient-to-br from-[#C27D10] via-[#1F5C2E] to-[#2d7a3e] p-[2.5px]">
              <span className="block rounded-full bg-[#FFF6E5] p-[2px]">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={s.sellerAvatar || s.image || undefined} />
                  <AvatarFallback className="bg-[#E8F0E9] text-[#1F5C2E]">
                    {s.sellerName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </span>
            </span>
            <span className="flex max-w-full items-center justify-center gap-0.5 truncate text-[10px] font-medium text-[#111827]">
              {s.sellerName.split(" ")[0]}
              {s.verified ? <BadgeCheck className="h-3 w-3 shrink-0 text-[#1F5C2E]" /> : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
