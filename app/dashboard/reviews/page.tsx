"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, Star, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  reviewer: { full_name: string; avatar_url: string | null }
  product: { name: string; images: { url: string }[] | null } | null
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [avgRating, setAvgRating] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login?redirect=/dashboard/reviews"); return }

      const { data } = await supabase
        .from("reviews")
        .select(`
          id, rating, comment, created_at,
          reviewer:reviewer_id (full_name, avatar_url),
          product:product_id (name, images)
        `)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })

      if (data && data.length > 0) {
        setReviews(data as unknown as Review[])
        const avg = data.reduce((sum: number, r: any) => sum + r.rating, 0) / data.length
        setAvgRating(avg)
      }
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-100">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="active:scale-90 transition-transform">
            <ChevronLeft className="h-6 w-6 text-neutral-900" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Mes avis</h1>
        </div>
      </header>

      {/* Summary */}
      <div className="p-5">
        <div className="bg-white rounded-2xl p-5 flex items-center gap-5 shadow-sm">
          <div className="text-center">
            <p className="text-4xl font-bold text-neutral-900">{avgRating.toFixed(1)}</p>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-neutral-200"}`} />
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">{reviews.length} avis</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5,4,3,2,1].map(s => {
              const count = reviews.filter(r => Math.round(r.rating) === s).length
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-neutral-500">{s}</span>
                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-neutral-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="px-5 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-100 rounded w-32" />
                    <div className="h-3 bg-neutral-100 rounded w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">Aucun avis pour le moment</p>
            <p className="text-sm text-neutral-400 mt-1">Les avis de vos acheteurs apparaitront ici</p>
          </div>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-100 overflow-hidden flex-shrink-0">
                  {review.reviewer?.avatar_url ? (
                    <Image src={review.reviewer.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-neutral-400">
                      {review.reviewer?.full_name?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{review.reviewer?.full_name || "Utilisateur"}</p>
                    <p className="text-xs text-neutral-400">{formatDate(review.created_at)}</p>
                  </div>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-neutral-200"}`} />
                    ))}
                  </div>
                  {review.product && (
                    <p className="text-xs text-neutral-400 mt-1">Produit : {review.product.name}</p>
                  )}
                  {review.comment && (
                    <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
