"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Heart, MessageCircle, Share2, UserPlus, Search, Bell,
  ShoppingBag, BadgeCheck, MapPin, Bookmark, MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  origin_region: string | null
  product_type: string
  seller_id: string
  profiles?: {
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    city: string | null
  }
}

type Post = {
  id: string
  content: string
  media_urls: { url: string; type: string }[] | null
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  author_id: string
  profiles?: {
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    user_type: string
  }
}

type FeedItem = 
  | { type: "product"; data: Product }
  | { type: "post"; data: Post }

const categories = [
  { id: "all", name: "Tout", icon: "🌍" },
  { id: "cereales", name: "Cereales", icon: "🌾" },
  { id: "cacao", name: "Cacao", icon: "🍫" },
  { id: "cafe", name: "Cafe", icon: "☕" },
  { id: "fruits", name: "Fruits", icon: "🥭" },
  { id: "legumes", name: "Legumes", icon: "🥬" },
  { id: "artisanat", name: "Artisanat", icon: "🎨" },
]

export default function HomePage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Charger produits
      const { data: products } = await supabase
        .from("products")
        .select(`
          id, name, price, unit, images, origin_region, product_type, seller_id,
          profiles!products_seller_id_fkey(full_name, avatar_url, is_verified, city)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10)

      // Charger posts
      const { data: posts } = await supabase
        .from("posts")
        .select(`
          id, content, media_urls, likes_count, comments_count, shares_count, created_at, author_id,
          profiles!posts_author_id_fkey(full_name, avatar_url, is_verified, user_type)
        `)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(10)

      // Melanger produits et posts dans le feed
      const feedItems: FeedItem[] = []
      const maxLen = Math.max(products?.length || 0, posts?.length || 0)
      
      for (let i = 0; i < maxLen; i++) {
        if (products?.[i]) feedItems.push({ type: "product", data: products[i] })
        if (posts?.[i]) feedItems.push({ type: "post", data: posts[i] })
      }

      setFeed(feedItems)
      setIsLoading(false)
    }
    loadData()
  }, [supabase])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)
  
  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "maintenant"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}j`
  }

  const toggleLike = useCallback((id: string) => {
    setLikedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#2F7D32]">GWA</h1>
            <div className="flex items-center gap-2">
              <Link href="/recherche">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <Search className="h-5 w-5 text-[#4B5563]" />
                </Button>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 relative">
                  <Bell className="h-5 w-5 text-[#4B5563]" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#F39A1F] rounded-full" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Categories tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pb-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          // Skeleton loader
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                </div>
              </div>
              <div className="aspect-video bg-gray-200 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))
        ) : feed.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-10 w-10 text-[#2F7D32]" />
            </div>
            <h3 className="font-semibold text-lg text-[#111827] mb-2">Bienvenue sur GWA</h3>
            <p className="text-[#4B5563] text-sm mb-6">
              Decouvrez et connectez-vous avec des producteurs et artisans africains
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/auth/signup">
                <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427]">
                  Creer un compte
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" className="w-full rounded-full bg-transparent">
                  Explorer le marketplace
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          // Feed items
          feed.map((item, index) => (
            item.type === "product" ? (
              // Product Card
              <div key={`product-${item.data.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-slideUp" style={{ animationDelay: `${index * 50}ms` }}>
                {/* Seller info */}
                <div className="flex items-center justify-between p-4 pb-3">
                  <Link href={`/vendeur/${item.data.seller_id}`} className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border-2 border-[#E5E7EB]">
                      <AvatarImage src={item.data.profiles?.avatar_url || ""} />
                      <AvatarFallback className="bg-[#2F7D32] text-white text-sm">
                        {item.data.profiles?.full_name?.[0] || "V"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[#111827] text-sm">
                          {item.data.profiles?.full_name || "Vendeur"}
                        </span>
                        {item.data.profiles?.is_verified && (
                          <BadgeCheck className="h-4 w-4 text-[#2F7D32]" />
                        )}
                      </div>
                      <p className="text-xs text-[#4B5563] flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.data.origin_region || item.data.profiles?.city || "Afrique"}
                      </p>
                    </div>
                  </Link>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                    <MoreHorizontal className="h-5 w-5 text-[#4B5563]" />
                  </Button>
                </div>

                {/* Product image */}
                <Link href={`/produit/${item.data.id}`}>
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={item.data.images?.[0] || "/placeholder.svg"}
                      alt={item.data.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </Link>

                {/* Actions */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleLike(item.data.id)}
                        className="flex items-center gap-1.5 text-[#4B5563] active:scale-90 transition-transform"
                      >
                        <Heart className={cn("h-6 w-6", likedItems.has(item.data.id) && "fill-[#F39A1F] text-[#F39A1F]")} />
                        <span className="text-sm font-medium">Aimer</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-[#4B5563]">
                        <MessageCircle className="h-6 w-6" />
                        <span className="text-sm font-medium">Commenter</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-[#4B5563]">
                        <Share2 className="h-6 w-6" />
                        <span className="text-sm font-medium">Partager</span>
                      </button>
                    </div>
                    <button>
                      <Bookmark className="h-6 w-6 text-[#4B5563]" />
                    </button>
                  </div>

                  {/* Product info */}
                  <Link href={`/produit/${item.data.id}`}>
                    <h3 className="font-semibold text-[#111827] mb-1">{item.data.name}</h3>
                    <p className="text-lg font-bold text-[#2F7D32]">
                      {formatPrice(item.data.price)} FCFA
                      <span className="text-sm font-normal text-[#4B5563]">/{item.data.unit}</span>
                    </p>
                  </Link>

                  {/* CTA */}
                  <div className="flex gap-2 mt-4">
                    <Link href={`/produit/${item.data.id}`} className="flex-1">
                      <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427] text-white font-semibold">
                        Acheter
                      </Button>
                    </Link>
                    <Button variant="outline" className="rounded-full px-4 bg-transparent border-[#F39A1F] text-[#F39A1F] hover:bg-[#F39A1F]/10">
                      <UserPlus className="h-5 w-5" />
                      <span className="ml-1.5 font-medium">Suivre</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Post Card (Social)
              <div key={`post-${item.data.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-slideUp" style={{ animationDelay: `${index * 50}ms` }}>
                {/* Author info */}
                <div className="flex items-center justify-between p-4 pb-3">
                  <Link href={`/profil/${item.data.author_id}`} className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border-2 border-[#E5E7EB]">
                      <AvatarImage src={item.data.profiles?.avatar_url || ""} />
                      <AvatarFallback className="bg-[#F39A1F] text-white text-sm">
                        {item.data.profiles?.full_name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[#111827] text-sm">
                          {item.data.profiles?.full_name || "Utilisateur"}
                        </span>
                        {item.data.profiles?.is_verified && (
                          <BadgeCheck className="h-4 w-4 text-[#2F7D32]" />
                        )}
                      </div>
                      <p className="text-xs text-[#4B5563]">
                        {item.data.profiles?.user_type || "Membre"} · {formatTimeAgo(item.data.created_at)}
                      </p>
                    </div>
                  </Link>
                  <Button variant="outline" size="sm" className="rounded-full h-8 px-4 bg-transparent border-[#F39A1F] text-[#F39A1F] text-xs font-semibold">
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Suivre
                  </Button>
                </div>

                {/* Post content */}
                <div className="px-4 pb-3">
                  <p className="text-[#111827] text-sm leading-relaxed whitespace-pre-wrap">
                    {item.data.content}
                  </p>
                </div>

                {/* Post media */}
                {item.data.media_urls && item.data.media_urls.length > 0 && (
                  <div className="relative aspect-video bg-gray-100">
                    <Image
                      src={item.data.media_urls[0].url || "/placeholder.svg"}
                      alt="Post media"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Social actions */}
                <div className="p-4 flex items-center justify-between border-t border-[#E5E7EB]">
                  <button 
                    onClick={() => toggleLike(item.data.id)}
                    className="flex items-center gap-1.5 active:scale-90 transition-transform"
                  >
                    <Heart className={cn(
                      "h-5 w-5",
                      likedItems.has(item.data.id) ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      likedItems.has(item.data.id) ? "text-[#F39A1F]" : "text-[#4B5563]"
                    )}>
                      {item.data.likes_count + (likedItems.has(item.data.id) ? 1 : 0)}
                    </span>
                  </button>
                  <button className="flex items-center gap-1.5 text-[#4B5563]">
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.data.comments_count}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-[#4B5563]">
                    <Share2 className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.data.shares_count}</span>
                  </button>
                  <button>
                    <Bookmark className="h-5 w-5 text-[#4B5563]" />
                  </button>
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  )
}
