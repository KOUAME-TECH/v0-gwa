"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Heart, ShoppingCart, Trash2, MapPin } from "lucide-react"
import { toast } from "sonner"

interface FavoriteProduct {
  id: string
  product_id: string
  created_at: string
  products: {
    id: string
    name: string
    price: number
    images: string[]
    origin_country: string
    origin_region: string
    unit: string
    seller_id: string
    status: string
    seller?: {
      full_name: string
      avatar_url: string
      is_verified: boolean
    }
  }
}

export default function FavorisPage() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadFavorites() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push("/auth/login")
        return
      }
      setUser(currentUser)

      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          product_id,
          created_at,
          products (
            id,
            name,
            price,
            images,
            origin_country,
            origin_region,
            unit,
            seller_id,
            status
          )
        `)
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })

      if (data && !error) {
        // Charger les profils des vendeurs
        const sellerIds = [...new Set(data.map((f: any) => f.products?.seller_id).filter(Boolean))]
        let sellerMap: Record<string, any> = {}
        
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, is_verified")
            .in("id", sellerIds)

          if (sellers) {
            sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]))
          }
        }

        const enrichedFavorites = data
          .filter((f: any) => f.products)
          .map((f: any) => ({
            ...f,
            products: {
              ...f.products,
              seller: sellerMap[f.products.seller_id] || null
            }
          }))

        setFavorites(enrichedFavorites)
      }
      setLoading(false)
    }

    loadFavorites()
  }, [])

  const removeFavorite = async (favoriteId: string, productName: string) => {
    if (!user) return

    setFavorites(prev => prev.filter(f => f.id !== favoriteId))

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", favoriteId)

    if (error) {
      toast.error("Erreur lors de la suppression")
      return
    }
    toast.success(`${productName} retiré des favoris`)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR").format(price) + " FCFA"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full h-9 w-9"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-[#111827]">Mes Favoris</h1>
        <span className="text-sm text-[#6B7280]">({favorites.length})</span>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mb-4">
            <Heart className="h-10 w-10 text-[#2F7D32]" />
          </div>
          <h2 className="text-lg font-semibold text-[#111827] mb-2">Aucun favori</h2>
          <p className="text-[#6B7280] text-sm mb-6">
            Explorez le marketplace et ajoutez des produits en favoris
          </p>
          <Link href="/marketplace">
            <Button className="rounded-full bg-[#2F7D32] hover:bg-[#256427]">
              Explorer le marketplace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3">
          {favorites.map((fav) => (
            <Card key={fav.id} className="overflow-hidden border-0 shadow-sm">
              <Link href={`/produit/${fav.products.id}`}>
                <div className="relative aspect-square bg-[#F3F4F6]">
                  {fav.products.images?.[0] ? (
                    <Image
                      src={fav.products.images[0] || "/placeholder.svg"}
                      alt={fav.products.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 text-[#9CA3AF]" />
                    </div>
                  )}
                  {fav.products.status !== "active" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="secondary" className="bg-white/90">Indisponible</Badge>
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/produit/${fav.products.id}`}>
                  <h3 className="font-medium text-sm text-[#111827] line-clamp-2 mb-1">
                    {fav.products.name}
                  </h3>
                </Link>
                <p className="text-[#2F7D32] font-bold text-sm mb-1">
                  {formatPrice(fav.products.price)}
                  <span className="text-[#9CA3AF] font-normal text-xs">/{fav.products.unit || "kg"}</span>
                </p>
                {fav.products.origin_country && (
                  <div className="flex items-center gap-1 text-[#6B7280] text-xs mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{fav.products.origin_region ? `${fav.products.origin_region}, ` : ""}{fav.products.origin_country}</span>
                  </div>
                )}
                {fav.products.seller && (
                  <p className="text-xs text-[#6B7280] mb-2 truncate">
                    Par {fav.products.seller.full_name}
                    {fav.products.seller.is_verified && " \u2713"}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-8"
                  onClick={() => removeFavorite(fav.id, fav.products.name)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Retirer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
