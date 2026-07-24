"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  BadgeCheck,
  ShoppingBag,
  MessageCircle,
  Minus,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ListenMicButton } from "@/components/media/clickable-listen-text"
import { buildProductListenText } from "@/lib/media/product-listen"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  unit: string
  stock_quantity: number
  min_order_quantity: number | null
  images: string[] | null
  video_url: string | null
  audio_url: string | null
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
  const [adding, setAdding] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadProduct = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)

      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id, name, price, unit, images, video_url, audio_url, description, origin_country, origin_region,
          is_organic, is_fair_trade, product_type, stock_quantity, min_order_quantity,
          seller_id, category_id, status, created_at, updated_at,
          profiles!products_seller_id_fkey(id, full_name, avatar_url, is_verified, city, country, rating),
          categories(name)
        `,
        )
        .eq("id", params.id)
        .maybeSingle()

      if (error) {
        console.error("[produit/[id]] load error:", error.message)
      }

      if (data) {
        setProduct(data as Product)
        setQuantity(data.min_order_quantity || 1)

        if (currentUser) {
          const { data: fav } = await supabase
            .from("favorites")
            .select("id")
            .eq("product_id", params.id)
            .eq("user_id", currentUser.id)
            .maybeSingle()
          setIsFavorite(!!fav)
        }
      }
      setIsLoading(false)
    }
    void loadProduct()
  }, [supabase, params.id])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  const handleQuantityChange = (delta: number) => {
    const minQty = product?.min_order_quantity || 1
    const maxQty = product?.stock_quantity || 100
    const newQty = quantity + delta
    if (newQty >= minQty && newQty <= maxQty) setQuantity(newQty)
  }

  const handleAddToCart = async (goCheckout: boolean) => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    setAdding(true)
    const { error } = await supabase.from("cart_items").upsert(
      {
        user_id: user.id,
        product_id: product?.id,
        quantity,
      },
      { onConflict: "user_id,product_id" },
    )
    setAdding(false)
    if (error) {
      toast.error("On n’a pas pu ajouter — réessaie.")
      return
    }
    toast.success("C’est dans ton panier")
    if (goCheckout) router.push("/panier")
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
      toast.success("Lien copié")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5]">
        <div className="mx-auto max-w-md animate-pulse">
          <div className="aspect-[4/3] bg-[#E8E4DC]" />
          <div className="space-y-3 p-5">
            <div className="h-6 w-3/4 rounded bg-[#E5E7EB]" />
            <div className="h-8 w-1/3 rounded bg-[#E5E7EB]" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFF6E5] p-6 text-center">
        <ShoppingBag className="mb-4 h-10 w-10 text-[#1F5C2E]/50" />
        <h2 className="font-display text-xl text-[#1F5C2E]">Plus dispo</h2>
        <p className="mt-2 max-w-xs text-sm text-[#4B5563]">
          Cette offre a été retirée. Tu peux regarder le marché.
        </p>
        <Button
          asChild
          className="mt-6 rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]"
        >
          <Link href="/marketplace">Voir le marché</Link>
        </Button>
      </div>
    )
  }

  const images = product.images?.length ? product.images : ["/placeholder.svg"]
  const profile = product.profiles
  const location = [profile?.city, profile?.country].filter(Boolean).join(", ")
  const totalPrice = product.price * quantity
  const verified = shouldShowVerifiedBadge(profile)

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-36">
      {/* Colonne étroite — lecture téléphone même sur ordi */}
      <div className="mx-auto w-full max-w-md">
        <header className="sticky top-0 z-40 flex items-center justify-between bg-[#FFF6E5]/95 px-3 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm active:scale-95"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Favori"
            >
              <Heart
                className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-[#4B5563]")}
              />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Partager"
            >
              <Share2 className="h-5 w-5 text-[#4B5563]" />
            </button>
          </div>
        </header>

        <div className="relative mx-3 overflow-hidden rounded-2xl bg-[#E8E4DC] aspect-[4/3]">
          <Image
            src={images[selectedImage] || "/placeholder.svg"}
            alt={product.name}
            fill
            className="object-cover"
            priority
            sizes="(max-width:768px) 100vw, 28rem"
          />
          {images.length > 1 ? (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === selectedImage ? "w-5 bg-white" : "w-1.5 bg-white/50",
                  )}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5 px-4 py-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {product.categories?.name ? (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#1F5C2E]">
                  {product.categories.name}
                </span>
              ) : null}
              {product.is_organic ? (
                <span className="rounded-full bg-[#E8F0E9] px-2.5 py-0.5 text-[11px] font-medium text-[#1F5C2E]">
                  Bio
                </span>
              ) : null}
              <ListenMicButton
                size="xs"
                text={buildProductListenText(product)}
                audioUrl={product.audio_url}
                fallbackLabel={product.name}
              />
            </div>
            <h1 className="font-display text-2xl leading-tight text-[#111827]">{product.name}</h1>
            <p className="mt-2">
              <span className="text-2xl font-semibold text-[#111827]">
                {formatPrice(product.price)}
              </span>
              <span className="text-base text-[#6B7280]"> FCFA / {product.unit}</span>
            </p>
          </div>

          <Link
            href={`/profil/${profile?.id}`}
            className="flex items-center gap-3 rounded-2xl bg-white/90 px-3 py-3 ring-1 ring-[#1F5C2E]/10"
          >
            <Avatar className="h-11 w-11">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-[#E8F0E9] text-[#1F5C2E]">
                {profile?.full_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-[#111827]">
                {profile?.full_name}
                {verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-[#1F5C2E]" /> : null}
              </p>
              <p className="truncate text-xs text-[#6B7280]">
                {[profile?.rating ? `★ ${profile.rating.toFixed(1)}` : null, location]
                  .filter(Boolean)
                  .join(" · ") || "Sur GWA"}
              </p>
            </div>
          </Link>

          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              className="flex-1 rounded-xl border-[#1F5C2E]/20 bg-white"
            >
              <Link href={`/messages?to=${profile?.id}`}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Écrire
              </Link>
            </Button>
          </div>

          {product.description ? (
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[#111827]">En bref</h2>
              <p className="text-[15px] leading-relaxed text-[#4B5563]">{product.description}</p>
            </div>
          ) : null}

          {product.origin_region ? (
            <p className="flex items-center gap-1.5 text-sm text-[#6B7280]">
              <MapPin className="h-4 w-4" />
              Vient de {product.origin_region}
            </p>
          ) : null}

          {product.video_url ? (
            <video
              src={product.video_url}
              controls
              playsInline
              className="max-h-64 w-full rounded-2xl bg-black"
            />
          ) : null}
        </div>
      </div>

      {/* Barre d’achat — même largeur max */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-[#1F5C2E]/10 bg-white/95 px-3 py-3 backdrop-blur-sm lg:bottom-0">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-[#F3F4F6] p-1">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
              disabled={quantity <= (product.min_order_quantity || 1)}
              aria-label="Moins"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => handleQuantityChange(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
              disabled={quantity >= product.stock_quantity}
              aria-label="Plus"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            disabled={adding}
            onClick={() => void handleAddToCart(true)}
            className="h-12 flex-1 rounded-xl bg-[#1F5C2E] text-[15px] font-semibold hover:bg-[#184a25]"
          >
            Acheter · {formatPrice(totalPrice)}
          </Button>
        </div>
      </div>
    </div>
  )
}
