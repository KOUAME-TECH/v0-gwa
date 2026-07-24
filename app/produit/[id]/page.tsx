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
  Star,
  Minus,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ListenMicButton } from "@/components/media/clickable-listen-text"
import { buildProductListenText } from "@/lib/media/product-listen"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"
import { addOrIncrementCart } from "@/lib/cart/add"
import { CartIconButton } from "@/components/cart/cart-icon-button"

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

      if (error) console.error("[produit/[id]] load error:", error.message)

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

  const handleQuantityInput = (raw: string) => {
    const minQty = product?.min_order_quantity || 1
    const maxQty = product?.stock_quantity || 100
    const digits = raw.replace(/\D/g, "")
    if (!digits) {
      setQuantity(minQty)
      return
    }
    const parsed = Number.parseInt(digits, 10)
    if (!Number.isFinite(parsed)) return
    setQuantity(Math.min(maxQty, Math.max(minQty, parsed)))
  }

  const handleAddToCart = async (goCheckout: boolean) => {
    if (!product) return
    setAdding(true)
    if (!user) {
      const { addGuestCartItem } = await import("@/lib/cart/guest")
      addGuestCartItem(product.id, quantity)
      setAdding(false)
      toast.success(goCheckout ? "Dans ta charette (hors ligne)" : "Ajouté à la charette")
      if (goCheckout) router.push("/panier")
      return
    }
    const res = await addOrIncrementCart(supabase, user.id, product.id, quantity)
    setAdding(false)
    if (!res.ok) {
      toast.error("On n’a pas pu ajouter. Réessaie.")
      return
    }
    toast.success(goCheckout ? "C’est dans ton panier" : "Ajouté au panier")
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
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = product?.name
      ? `Regarde ${product.name} sur GWA`
      : "Découvre GWA"
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text, url })
        return
      } catch {
        /* fall through */
      }
    }
    window.open(wa, "_blank", "noopener,noreferrer")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="animate-pulse lg:mx-auto lg:max-w-6xl lg:grid lg:grid-cols-2 lg:gap-10 lg:p-8">
          <div className="aspect-square bg-neutral-100 lg:rounded-3xl" />
          <div className="space-y-4 p-5">
            <div className="h-6 w-3/4 rounded bg-neutral-100" />
            <div className="h-8 w-1/3 rounded bg-neutral-100" />
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
        <p className="mt-2 max-w-xs text-sm text-[#4B5563]">Cette offre a été retirée.</p>
        <Button asChild className="mt-6 rounded-full bg-[#1F5C2E] hover:bg-[#184a25]">
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
  const minQty = product.min_order_quantity || 1

  const QtyControl = ({ className }: { className?: string }) => (
    <div className={cn("flex items-center gap-1 rounded-full bg-neutral-100 p-1", className)}>
      <button
        type="button"
        onClick={() => handleQuantityChange(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm active:scale-95"
        disabled={quantity <= minQty}
        aria-label="Moins"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={minQty}
        max={product.stock_quantity}
        value={quantity}
        onChange={(e) => handleQuantityInput(e.target.value)}
        className="w-12 border-0 bg-transparent text-center text-lg font-semibold tabular-nums focus:outline-none"
        aria-label="Quantité"
      />
      <button
        type="button"
        onClick={() => handleQuantityChange(1)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm active:scale-95"
        disabled={quantity >= product.stock_quantity}
        aria-label="Plus"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )

  const SellerBlock = () => (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <Link href={`/profil/${profile?.id}`} className="flex items-center gap-3">
        <Avatar className="h-14 w-14 ring-2 ring-white">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-neutral-200 font-medium text-neutral-600">
            {profile?.full_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{profile?.full_name}</span>
            {verified ? <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-sm text-neutral-500">
            {profile?.rating ? (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {profile.rating.toFixed(1)}
              </span>
            ) : null}
            {location ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {location}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <Link href={`/messages?to=${profile?.id}`} className="mt-4 block">
        <Button variant="outline" className="h-11 w-full rounded-full bg-white font-medium">
          <MessageCircle className="mr-2 h-4 w-4" />
          Contacter
        </Button>
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-white pb-44 lg:bg-[#FFF6E5] lg:pb-10">
      {/* —— MOBILE : style prod (plein écran, photo carrée) —— */}
      <div className="lg:hidden">
        <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between p-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:scale-95"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <CartIconButton className="h-10 w-10 rounded-full bg-white shadow-md" />
            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:scale-95"
              aria-label="Favori"
            >
              <Heart className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-neutral-600")} />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:scale-95"
              aria-label="Partager"
            >
              <Share2 className="h-5 w-5 text-neutral-600" />
            </button>
          </div>
        </header>

        <div className="relative aspect-square bg-neutral-100">
          <Image
            src={images[selectedImage] || "/placeholder.svg"}
            alt={product.name}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {images.length > 1 ? (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === selectedImage ? "w-6 bg-white" : "w-2 bg-white/50",
                  )}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        {product.video_url ? (
          <div className="px-5 pt-5">
            <video src={product.video_url} controls playsInline className="max-h-80 w-full rounded-2xl bg-black" />
          </div>
        ) : null}

        <div className="space-y-6 px-5 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              Agriculture
              <ListenMicButton size="xs" text={buildProductListenText(product)} audioUrl={product.audio_url} fallbackLabel={product.name} />
            </span>
            {product.categories?.name ? (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {product.categories.name}
              </span>
            ) : null}
            {product.is_organic ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Bio</span>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-start gap-2">
              <h1 className="flex-1 text-2xl font-bold leading-tight text-neutral-900">{product.name}</h1>
              <ListenMicButton text={buildProductListenText(product)} audioUrl={product.audio_url} fallbackLabel={product.name} className="mt-1" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
              <span className="text-lg text-neutral-500">FCFA/{product.unit}</span>
            </div>
          </div>

          <SellerBlock />

          {product.description ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-semibold text-neutral-800">Description</h3>
                <ListenMicButton size="xs" text={product.description} />
              </div>
              <p className="text-[15px] leading-relaxed text-neutral-600">{product.description}</p>
            </div>
          ) : null}

          {product.origin_region ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <MapPin className="h-4 w-4" />
              <span>Origine: {product.origin_region}</span>
            </div>
          ) : null}
        </div>

        <div className="fixed bottom-[76px] left-0 right-0 z-40 border-t border-neutral-100 bg-white/95 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <QtyControl />
              <p className="text-right">
                <span className="block text-xs text-neutral-500">Total</span>
                <span className="text-lg font-bold tabular-nums">{formatPrice(totalPrice)} FCFA</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={adding}
                variant="outline"
                onClick={() => void handleAddToCart(false)}
                className="h-12 flex-1 rounded-full border-neutral-200 font-semibold"
              >
                Au panier
              </Button>
              <Button
                disabled={adding}
                onClick={() => void handleAddToCart(true)}
                className="h-12 flex-[1.4] rounded-full text-[15px] font-semibold"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                Acheter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* —— DESKTOP : composition 2 colonnes Harmattan —— */}
      <div className="mx-auto hidden max-w-6xl gap-10 px-6 py-8 lg:grid lg:grid-cols-2 xl:gap-14">
        <div>
          <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-3xl bg-[#E8E4DC] shadow-sm ring-1 ring-[#1F5C2E]/10">
            <Image
              src={images[selectedImage] || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="40vw"
            />
          </div>
          {images.length > 1 ? (
            <div className="flex gap-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "relative h-16 w-16 overflow-hidden rounded-xl ring-2 transition",
                    i === selectedImage ? "ring-[#1F5C2E]" : "ring-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#1F5C2E]"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <div className="flex items-center gap-2">
              <CartIconButton className="bg-white shadow-sm ring-1 ring-[#E5E7EB]" />
              <button type="button" onClick={() => void handleToggleFavorite()} className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#E5E7EB]" aria-label="Favori">
                <Heart className={cn("h-5 w-5", isFavorite ? "fill-red-500 text-red-500" : "text-[#4B5563]")} />
              </button>
              <button type="button" onClick={() => void handleShare()} className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#E5E7EB]" aria-label="Partager">
                <Share2 className="h-5 w-5 text-[#4B5563]" />
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white/95 p-7 shadow-sm ring-1 ring-[#1F5C2E]/10">
            <div className="mb-3 flex flex-wrap gap-2">
              {product.categories?.name ? (
                <span className="rounded-full bg-[#E8F0E9] px-3 py-1 text-xs font-medium text-[#1F5C2E]">
                  {product.categories.name}
                </span>
              ) : null}
              {product.is_organic ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Bio</span>
              ) : null}
            </div>
            <h1 className="font-display text-3xl text-[#111827]">{product.name}</h1>
            <p className="mt-3">
              <span className="text-3xl font-semibold">{formatPrice(product.price)}</span>
              <span className="text-lg text-[#6B7280]"> FCFA / {product.unit}</span>
            </p>

            {product.description ? (
              <p className="mt-5 text-[15px] leading-relaxed text-[#4B5563]">{product.description}</p>
            ) : null}

            <div className="mt-6">
              <SellerBlock />
            </div>

            <div className="mt-8 flex items-center gap-4 border-t border-[#E5E7EB] pt-6">
              <div>
                <p className="mb-1.5 text-xs font-medium text-[#6B7280]">Quantité</p>
                <QtyControl />
              </div>
              <div className="flex-1 space-y-2">
                <Button
                  disabled={adding}
                  onClick={() => void handleAddToCart(true)}
                  className="h-12 w-full rounded-xl bg-[#1F5C2E] text-[15px] font-semibold hover:bg-[#184a25]"
                >
                  Acheter {formatPrice(totalPrice)} FCFA
                </Button>
                <Button
                  disabled={adding}
                  variant="outline"
                  onClick={() => void handleAddToCart(false)}
                  className="h-11 w-full rounded-xl border-[#1F5C2E]/25 bg-white"
                >
                  Ajouter au panier
                </Button>
              </div>
            </div>

            {product.origin_region ? (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-[#6B7280]">
                <MapPin className="h-4 w-4" />
                Vient de {product.origin_region}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
