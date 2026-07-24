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

/**
 * Rail « Aujourd’hui » — offres des dernières 24 h (stories légères sans nouvelle table).
 */
export function StoriesRail({ className }: { className?: string }) {
  const [items, setItems] = useState<StoryItem[]>([])
  const supabase = createClient()

  useEffect(() => {
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
  }, [supabase])

  if (items.length === 0) return null

  return (
    <section className={cn("px-3 py-3", className)} aria-label="Aujourd’hui près de toi">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[#1F5C2E]/80">
        Aujourd’hui
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {items.map((s) => (
          <Link
            key={s.id}
            href={`/produit/${s.id}`}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 active:opacity-80"
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
