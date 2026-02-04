"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  ArrowLeft, Heart, Share2, MapPin, BadgeCheck, ShoppingBag, 
  MessageCircle, Star, Minus, Plus, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  unit: string
  stock_quantity: number
  min_order_quantity: number | null
  images: string[] | null
  origin_region: string | null
  product_type: string
  is_organic: boolean | null
  seller_id: string
  profiles?: {
    id: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    city: string | null
    country: string | null
    rating: number | null
  }
  categories?: {
    name: string
  }
}

export default function ProduitPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadProduct = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      const { data } = await supabase
        .from("products")
        .select(`
          *,
          profiles!products_seller_id_fkey(id, full_name, avatar_url, is_verified, city, country, rating),
          categories(name)
        `)
        .eq("id", params.id)
        .single()

      if (data) {
        setProduct(data as Product)
        setQuantity(data.min_order_quantity || 1)
        
        if (currentUser) {
          const { data: fav } = await supabase
            .from("favorites")
            .select("id")
            .eq("product_id", params.id)
            .eq("user_id", currentUser.id)
            .single()
          setIsFavorite(!!fav)
        }
      }
      setIsLoading(false)
    }
    loadProduct()
  }, [supabase, params.id])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  const handleQuantityChange = (delta: number) => {
    const minQty = product?.min_order_quantity || 1
    const maxQty = product?.stock_quantity || 100
    const newQty = quantity + delta
    if (newQty >= minQty && newQty <= maxQty) {
      setQuantity(newQty)
    }
  }

  const handleAddToCart = async () => {
    if (!user) {
      router.push("/auth/login")
      return
    }

    const { error } = await supabase
      .from("cart_items")
      .upsert({
        user_id: user.id,
        product_id: product?.id,
        quantity: quantity,
      }, { onConflict: "user_id,product_id" })

    if (error) {
      toast.error("Erreur")
    } else {
      toast.success("Ajoute au panier")
    }
  }

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push("/auth/login")
      return
    }

    if (isFavorite) {
      await supabase.from("favorites").delete().eq("product_id", product?.id).eq("user_id", user.id)
    } else {
      await supabase.from("favorites").insert({ product_id: product?.id, user_id: user.id })
    }
    setIsFavorite(!isFavorite)
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product?.name, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Lien copie")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="animate-pulse">
          <div className="aspect-square bg-neutral-100" />
          <div className="p-5 space-y-4">
            <div className="h-6 bg-neutral-100 rounded w-3/4" />
            <div className="h-8 bg-neutral-100 rounded w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-5">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Produit non trouve</h2>
          <Link href="/recherche">
            <Button className="rounded-full">Retour</Button>
          </Link>
        </div>
      </div>
    )
  }

  const images = product.images?.length ? product.images : ["/placeholder.svg"]
  const profile = product.profiles
  const location = [profile?.city, profile?.country].filter(Boolean).join(", ")
  const totalPrice = product.price * quantity

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleFavorite}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Heart className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-neutral-600")} />
          </button>
          <button 
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="h-5 w-5 text-neutral-600" />
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="relative aspect-square bg-neutral-100">
        <Image
          src={images[selectedImage] || "/placeholder.svg"}
          alt={product.name}
          fill
          className="object-cover"
          priority
        />
        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === selectedImage ? "bg-white w-6" : "bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-6 space-y-6">
        {/* Category & Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            product.product_type === "agriculture" 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-amber-100 text-amber-700"
          )}>
            {product.product_type === "agriculture" ? "Agriculture" : "Artisanat"}
          </span>
          {product.categories && (
            <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">
              {product.categories.name}
            </span>
          )}
          {product.is_organic && (
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              Bio
            </span>
          )}
        </div>

        {/* Title & Price */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 leading-tight mb-2">{product.name}</h1>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
            <span className="text-lg text-neutral-500">FCFA/{product.unit}</span>
          </div>
        </div>

        {/* Seller Card */}
        <div className="bg-neutral-50 rounded-2xl p-4">
          <Link href={`/vendeur/${profile?.id}`} className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-white">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-neutral-200 text-neutral-600 font-medium">
                {profile?.full_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px] truncate">{profile?.full_name}</span>
                {profile?.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-500 mt-0.5">
                {profile?.rating && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {profile.rating.toFixed(1)}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {location}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-300" />
          </Link>
          
          <Link href={`/messages?to=${profile?.id}`} className="block mt-4">
            <Button variant="outline" className="w-full h-11 rounded-full font-medium bg-white">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contacter
            </Button>
          </Link>
        </div>

        {/* Description */}
        {product.description && (
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-neutral-600 leading-relaxed text-[15px]">{product.description}</p>
          </div>
        )}

        {/* Origin */}
        {product.origin_region && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <MapPin className="h-4 w-4" />
            <span>Origine: {product.origin_region}</span>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-4">
          {/* Quantity */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
            <button 
              onClick={() => handleQuantityChange(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-sm active:scale-95 transition-transform"
              disabled={quantity <= (product.min_order_quantity || 1)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-semibold text-lg">{quantity}</span>
            <button 
              onClick={() => handleQuantityChange(1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-sm active:scale-95 transition-transform"
              disabled={quantity >= product.stock_quantity}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Add to Cart */}
          <Button 
            onClick={handleAddToCart}
            className="flex-1 h-12 rounded-full text-[15px] font-semibold"
          >
            <ShoppingBag className="h-5 w-5 mr-2" />
            {formatPrice(totalPrice)} FCFA
          </Button>
        </div>
      </div>
    </div>
  )
}
