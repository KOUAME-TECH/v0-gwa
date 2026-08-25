"use client"

import { useState, useEffect, useMemo, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, MapPin, Heart, X, ChevronLeft, Plus, ShoppingBag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { toast } from "sonner"
import { ListenMicButton } from "@/components/media/clickable-listen-text"
import { buildProductListenText } from "@/lib/media/product-listen"
import { ShopVoiceTourButton } from "@/components/media/shop-voice-tour-button"
import { DigestBanner } from "@/components/media/digest-banner"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"
import { useShopVoiceTour } from "@/hooks/use-shop-voice-tour"
import { useRealtimeLocation } from "@/hooks/use-realtime-location"
import { useDataSaver } from "@/hooks/use-data-saver"
import {
  digestModeLabel,
  selectDigestProducts,
} from "@/lib/products/digest"
import {
  catalogCacheAgeLabel,
  loadCatalogCache,
  saveCatalogCache,
} from "@/lib/offline/catalog-cache"
import { CartIconButton } from "@/components/cart/cart-icon-button"
import { addOrIncrementCart } from "@/lib/cart/add"
import { prefetchProduct } from "@/lib/products/prefetch"
import { cn } from "@/lib/utils"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
import {
  feedPriorityForTier,
  hasProBadge,
  sortByFeedPriority,
} from "@/lib/pricing/entitlements"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  description: string | null
  audio_url: string | null
  audio_lang: string | null
  created_at: string
  images: string[] | null
  origin_country: string
  origin_region: string | null
  is_organic: boolean
  is_fair_trade: boolean
  product_type: string
  category_id: string | null
  seller_id: string
  feedPriority?: number
  profiles: {
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    subscription_tier?: string | null
  } | null
  categories: { name: string; slug: string } | null
}

type Category = { id: string; name: string; slug: string; category_type: string }

function MarketplaceGridCard({
  product: p,
  listening,
  favorited,
  listenProps,
  onToggleFavorite,
  onAddToCart,
  formatPrice,
  imageQuality,
  priority = false,
  onPrefetch,
}: {
  product: Product
  listening: boolean
  favorited: boolean
  listenProps: {
    text: string
    audioUrl?: string | null
    audioLang?: string | null
    fallbackLabel: string
    highlight?: boolean
  }
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onAddToCart: (id: string, e: React.MouseEvent) => void
  formatPrice: (n: number) => string
  imageQuality: number
  priority?: boolean
  onPrefetch?: (p: Product) => void
}) {
  return (
    <Link
      href={`/produit/${p.id}`}
      className="block active:scale-[0.98] transition-transform"
      onMouseEnter={() => onPrefetch?.(p)}
      onFocus={() => onPrefetch?.(p)}
      onTouchStart={() => onPrefetch?.(p)}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#F3F4F6] to-[#E8E4DC] ring-1 gwa-product-media ${
          listening ? "ring-2 ring-[#C27D10] shadow-md" : "ring-black/[0.04]"
        }`}
        style={{ aspectRatio: "4/5" }}
      >
        {p.images?.[0] ? (
          <Image
            src={p.images[0]}
            alt={p.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            {...(priority
              ? { priority: true, fetchPriority: "high" as const }
              : { loading: "lazy" as const })}
            quality={imageQuality}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#E8F0E9] via-[#FFF6E5] to-[#E8E4DC] flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-[#2F7D32]/40" />
          </div>
        )}
        <button
          type="button"
          onClick={(e) => onToggleFavorite(p.id, e)}
          className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
        </button>
        {p.is_organic && (
          <Badge className="absolute top-2 left-2 bg-[#2F7D32] text-white text-[10px] px-1.5 py-0.5">Bio</Badge>
        )}
        {p.created_at &&
          Date.now() - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000 && (
            <Badge
              className={cn(
                "absolute top-2 text-white text-[10px] px-1.5 py-0.5 bg-[#C27D10]",
                p.is_organic ? "left-12" : "left-2",
              )}
            >
              Nouveau
            </Badge>
          )}
      </div>
      <div className="pt-2.5 px-0.5">
        <div className="flex items-start gap-1">
          <p className="text-sm font-medium leading-tight line-clamp-2 flex-1 min-w-0">{p.name}</p>
          <ListenMicButton size="sm" {...listenProps} />
        </div>
        {p.profiles && (
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {p.profiles.full_name}
            {p.profiles.is_verified && <span className="text-[#2F7D32]">{"✓"}</span>}
            {hasProBadge(p.profiles.subscription_tier) && (
              <Badge className="bg-[#C27D10]/15 text-[#8B5A00] text-[9px] px-1 py-0 h-4">Pro</Badge>
            )}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-bold text-red-600">
            {formatPrice(p.price)}{" "}
            <span className="text-[10px] font-normal text-gray-500">FCFA/{p.unit}</span>
          </span>
          <button
            type="button"
            onClick={(e) => onAddToCart(p.id, e)}
            className="w-8 h-8 rounded-full bg-[#2F7D32] text-white flex items-center justify-center"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF6E5] p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <MarketplaceContent />
    </Suspense>
  )
}

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isDigest = searchParams.get("digest") === "1"
  const sinceParam = searchParams.get("since")
  const idsParam = searchParams.get("ids")
  const digestStartedRef = useRef(false)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userCity, setUserCity] = useState<string | null>(null)
  const [userCountry, setUserCountry] = useState<string | null>(null)
  const {
    city: geoCity,
    country: geoCountry,
    label: geoLabel,
  } = useRealtimeLocation({ auto: true, maximumAge: 300_000 })
  const supabase = createClient()
  const headerHidden = useHideOnScroll(true)
  const { imageQuality } = useDataSaver()

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const onSync = () => {
      if (navigator.onLine) void fetchData()
    }
    window.addEventListener("online", onSync)
    window.addEventListener("gwa:online-sync", onSync as EventListener)
    return () => {
      window.removeEventListener("online", onSync)
      window.removeEventListener("gwa:online-sync", onSync as EventListener)
    }
  }, [])

  // GPS temps réel prioritaire pour Digest (avec permission)
  useEffect(() => {
    if (geoCity) setUserCity(geoCity)
    if (geoCountry) setUserCountry(geoCountry)
  }, [geoCity, geoCountry])

  // Persister la position sur le profil (Digest cron / push)
  useEffect(() => {
    if (!userId) return
    if (!geoCity && !geoCountry && !geoLabel) return
    // Prefer structured save when we have coords from hook storage
    try {
      const raw = localStorage.getItem("gwa-realtime-location")
      const cached = raw
        ? (JSON.parse(raw) as {
            lat?: number
            lon?: number
            city?: string | null
            country?: string | null
            region?: string | null
          })
        : null
      if (cached?.lat != null && cached?.lon != null) {
        void fetch("/api/location/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: cached.lat,
            lon: cached.lon,
            city: cached.city ?? geoCity,
            country: cached.country ?? geoCountry,
            region: cached.region,
          }),
        })
        return
      }
    } catch {
      /* ignore */
    }
    void supabase
      .from("profiles")
      .update({
        ...(geoCity ? { city: geoCity } : {}),
        ...(geoCountry ? { country: geoCountry } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("[marketplace] geo profile update", error.message)
      })
  }, [userId, geoCity, geoCountry, geoLabel, supabase])

  async function fetchData() {
    setIsLoading(true)
    const offline = typeof navigator !== "undefined" && !navigator.onLine
    const cached = loadCatalogCache()

    // Affiche immédiatement le cache hors ligne (ou en secours réseau)
    if (offline && cached?.products?.length) {
      setProducts(cached.products as Product[])
      if (cached.categories?.length) setCategories(cached.categories)
      setIsLoading(false)
      toast.message(`Boutique hors ligne · ${catalogCacheAgeLabel(cached.at)}`)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      const profilePromise = user
        ? supabase.from("profiles").select("city, country, digest_enabled").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null as { city?: string | null; country?: string | null } | null })

      const digestIds = idsParam
        ? idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 40)
        : []

      const catalogQuery = supabase
        .from("products")
        .select(`
          id, name, price, unit, description, audio_url, audio_lang, created_at, images,
          origin_country, origin_region,
          is_organic, is_fair_trade, product_type, category_id, seller_id,
          profiles:seller_id(full_name, avatar_url, is_verified, subscription_tier),
          categories:category_id(name, slug)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(48)

      const digestIdsQuery =
        digestIds.length > 0
          ? supabase
              .from("products")
              .select(`
          id, name, price, unit, description, audio_url, audio_lang, created_at, images,
          origin_country, origin_region,
          is_organic, is_fair_trade, product_type, category_id, seller_id,
          profiles:seller_id(full_name, avatar_url, is_verified),
          categories:category_id(name, slug)
        `)
              .eq("status", "active")
              .in("id", digestIds)
          : Promise.resolve({ data: [] as Product[] })

      const [productsRes, digestIdsRes, categoriesRes, favsRes, profileRes] = await Promise.all([
        catalogQuery,
        digestIdsQuery,
        supabase.from("categories").select("id, name, slug, category_type").eq("category_type", "agriculture").is("parent_id", null).order("name"),
        user ? supabase.from("favorites").select("product_id").eq("user_id", user.id).limit(200) : Promise.resolve({ data: [] as { product_id: string }[] }),
        profilePromise,
      ])

      const catalog = (productsRes.data || []) as Product[]
      const digestExtra = (digestIdsRes.data || []) as Product[]
      const byId = new Map<string, Product>()
      for (const p of [...digestExtra, ...catalog]) {
        const tier = p.profiles?.subscription_tier
        byId.set(p.id, {
          ...p,
          feedPriority: feedPriorityForTier(tier),
        })
      }
      const merged = sortByFeedPriority([...byId.values()]).slice(0, 24)
      setProducts(merged)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (favsRes.data) setFavorites(new Set((favsRes.data as { product_id: string }[]).map(f => f.product_id)))
      if (!geoCity && profileRes.data?.city) setUserCity(profileRes.data.city)
      if (!geoCountry && profileRes.data?.country) setUserCountry(profileRes.data.country)

      if (merged.length > 0) {
        saveCatalogCache(merged, categoriesRes.data || [])
      }
    } catch (err) {
      console.warn("[marketplace] fetch failed, trying cache", err)
      if (cached?.products?.length) {
        setProducts(cached.products as Product[])
        if (cached.categories?.length) setCategories(cached.categories)
        toast.message(`Boutique hors ligne · ${catalogCacheAgeLabel(cached.at)}`)
      } else {
        toast.error("Impossible de charger la boutique")
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!userId) { toast.error("Connecte-toi pour ajouter aux favoris"); return }
    const isFav = favorites.has(id)
    setFavorites(prev => { const s = new Set(prev); isFav ? s.delete(id) : s.add(id); return s })
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", id)
    } else {
      await supabase.from("favorites").insert({ user_id: userId, product_id: id })
    }
  }

  async function addToCart(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!userId) {
      const { addGuestCartItem } = await import("@/lib/cart/guest")
      addGuestCartItem(id, 1)
      toast.success("Ajouté à la charette — connecte-toi pour commander")
      return
    }
    const res = await addOrIncrementCart(supabase, userId, id, 1)
    if (!res.ok) toast.error("Erreur ajout panier")
    else toast.success("Ajouté au panier")
  }

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = selectedType === "all" || p.product_type === selectedType
        const matchesCategory =
          selectedCategory === "all" || p.category_id === selectedCategory
        return matchesSearch && matchesType && matchesCategory
      }),
    [products, searchTerm, selectedType, selectedCategory],
  )

  const filteredCategories = useMemo(
    () => categories.filter((c) => selectedType === "all" || c.category_type === selectedType),
    [categories, selectedType],
  )
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
  const activeFiltersCount = (selectedType !== "all" ? 1 : 0) + (selectedCategory !== "all" ? 1 : 0)

  const digestSelection = useMemo(() => {
    const profile = {
      id: userId || "anon",
      city: userCity || geoCity,
      country: userCountry || geoCountry,
    }

    // Deep-link push Digest (?digest=1&ids=…)
    if (isDigest) {
      let list = products
      if (idsParam) {
        const ids = new Set(idsParam.split(",").filter(Boolean))
        if (ids.size > 0) {
          list = list.filter((p) => ids.has(p.id))
          if (list.length > 0) {
            return {
              products: list,
              mode: "regional_24h" as const,
              since: sinceParam ? new Date(sinceParam) : new Date(),
            }
          }
        }
      }
      // Pas d'ids / ids introuvables → sélection intelligente (pas tout le catalogue)
      return selectDigestProducts(products, profile, 10)
    }

    return selectDigestProducts(products, profile, 10)
  }, [
    products,
    idsParam,
    isDigest,
    sinceParam,
    userCity,
    userCountry,
    userId,
    geoCity,
    geoCountry,
  ])

  const digestProducts = digestSelection.products
  const digestSubtitle = digestModeLabel(
    digestSelection.mode,
    userCity || geoCity || geoLabel,
  )

  const parcoursProducts = useMemo(
    () =>
      filteredProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        unit: p.unit,
        description: p.description,
        origin_region: p.origin_region,
        origin_country: p.origin_country,
        product_type: p.product_type,
        is_organic: p.is_organic,
        audio_url: p.audio_url,
        audio_lang: p.audio_lang,
      })),
    [filteredProducts],
  )

  const digestTourProducts = useMemo(
    () =>
      digestProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        unit: p.unit,
        description: p.description,
        origin_region: p.origin_region,
        origin_country: p.origin_country,
        product_type: p.product_type,
        is_organic: p.is_organic,
        audio_url: p.audio_url,
        audio_lang: p.audio_lang,
      })),
    [digestProducts],
  )

  const parcours = useShopVoiceTour(parcoursProducts)
  const digest = useShopVoiceTour(digestTourProducts)

  const handleParcoursClick = () => {
    if (parcours.active) {
      parcours.stop()
      toast.message("Parcours arrêté")
      return
    }
    if (parcours.total === 0) {
      toast.error("Aucun produit à parcourir pour le moment")
      return
    }
    if (digest.active) digest.stop()
    const ok = parcours.startTour()
    if (ok) toast.success(`Parcours · ${parcours.total} produit${parcours.total > 1 ? "s" : ""}`)
    else if (parcours.error) toast.error(parcours.error)
  }

  const handleDigestClick = () => {
    if (digest.active) {
      digest.stop()
      toast.message("Digest arrêté")
      return
    }
    if (digest.total === 0) {
      toast.error("Aucun nouveau produit dans le digest")
      return
    }
    if (parcours.active) parcours.stop()
    const ok = digest.startTour()
    if (ok) toast.success(`Digest · ${digest.total} nouveauté${digest.total > 1 ? "s" : ""}`)
    else if (digest.error) toast.error(digest.error)
  }

  useEffect(() => {
    if (parcours.error) toast.error(parcours.error)
  }, [parcours.error])

  useEffect(() => {
    if (digest.error) toast.error(digest.error)
  }, [digest.error])

  useEffect(() => {
    // Deep-link digest : mode écoute prêt (l'utilisateur tape le banner)
    if (!isDigest || digestProducts.length === 0 || digestStartedRef.current || isLoading) return
    digestStartedRef.current = true
    try {
      localStorage.setItem("gwa-listen-mode", "1")
    } catch {
      /* ignore */
    }
    toast.message("Digest prêt — tapez la bannière verte pour écouter.", { duration: 4000 })
  }, [digestProducts.length, isDigest, isLoading])

  function productListenProps(p: Product) {
    return {
      text: buildProductListenText(p),
      audioUrl: p.audio_url,
      audioLang: p.audio_lang,
      fallbackLabel: p.name,
      highlight: digest.active || isDigest,
    }
  }

  // ---- GRID CARD stable (évite remount → cancel TTS au setIndex) ----
  const listeningId =
    parcours.active
      ? parcours.currentProductId
      : digest.active
        ? digest.currentProductId
        : null

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-40 bg-white/95 border-b border-[#E5E7EB] backdrop-blur-sm lg:bg-[#FFF6E5]/90 lg:border-[#1F5C2E]/10",
          "transition-transform duration-300 ease-out will-change-transform",
          headerHidden && "-translate-y-full",
        )}
        aria-hidden={headerHidden}
      >
        <div className="gwa-shell-wide flex items-center gap-3 p-3 md:px-5 lg:py-4">
          <Link href="/" className="lg:hidden"><ChevronLeft className="h-6 w-6" /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-[#111827] lg:font-display lg:text-2xl lg:text-[#1F5C2E]">
              Boutique
            </h1>
            <p className="hidden lg:block text-sm text-[#4B5563] mt-0.5">
              Produits frais près de toi — écoute ou parcours
            </p>
          </div>
          <YellyAideButton source="marketplace_header" compact className="lg:hidden text-[#1F5C2E]" />
          <ShopVoiceTourButton
            active={parcours.active}
            index={parcours.index}
            total={parcours.total}
            onClick={handleParcoursClick}
            idleLabel="Parcours"
            className="shrink-0"
          />
          <CartIconButton />
        </div>

        {/* Search */}
        <div className="gwa-shell-wide flex gap-2 px-3 md:px-5 pb-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-0 h-9 rounded-xl text-sm" />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 relative shrink-0 rounded-xl border-0 bg-muted/50">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#2F7D32] text-white text-[9px] rounded-full flex items-center justify-center">{activeFiltersCount}</span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl md:left-1/2 md:max-w-lg md:-translate-x-1/2">
              <SheetHeader className="pb-3"><SheetTitle>Filtres</SheetTitle></SheetHeader>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: "all", label: "Tout" }, { value: "agriculture", label: "Agriculture" }].map(t => (
                      <button key={t.value} onClick={() => { setSelectedType(t.value); setSelectedCategory("all") }}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${selectedType === t.value ? "bg-[#2F7D32] text-white" : "bg-muted text-muted-foreground"}`}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Categorie</label>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    <button onClick={() => setSelectedCategory("all")}
                      className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === "all" ? "bg-[#2F7D32] text-white" : "bg-muted text-muted-foreground"}`}>Toutes</button>
                    {filteredCategories.map(c => (
                      <button key={c.id} onClick={() => setSelectedCategory(c.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === c.id ? "bg-[#2F7D32] text-white" : "bg-muted text-muted-foreground"}`}>{c.name}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-3">
                  <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => { setSelectedType("all"); setSelectedCategory("all") }}>Reinitialiser</Button>
                  <Button className="flex-1 rounded-xl h-11 bg-[#2F7D32] hover:bg-[#256025]" onClick={() => setShowFilters(false)}>Voir {filteredProducts.length} resultats</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Quick filters */}
        <div className="gwa-shell-wide flex gap-1.5 overflow-x-auto gwa-no-scroll px-3 md:px-5 pb-2">
          {[{ value: "all", label: "Tout" }, { value: "agriculture", label: "Agriculture" }].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setSelectedType(t.value)
                setSelectedCategory("all")
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                selectedType === t.value
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="gwa-shell-wide p-4 sm:p-5 md:px-6 lg:pb-10">
        {/* Digest visible dans la boutique (et via ?digest=1) */}
        {digestProducts.length > 0 && (
          <DigestBanner
            count={digestProducts.length}
            city={userCity || geoCity || geoLabel}
            subtitle={`${digestProducts.length} · ${digestSubtitle}. Écouter`}
            tourActive={digest.active}
            tourIndex={digest.index}
            tourTotal={digest.total}
            onStartTour={handleDigestClick}
          />
        )}
        {digestProducts.length === 0 && !isLoading && (
          <button
            type="button"
            onClick={() => {
              toast.message("Catalogue vide. Revenez plus tard ou lancez le Parcours.")
            }}
            className="mb-3 w-full rounded-2xl border border-dashed border-[#1F5C2E]/25 bg-white px-3 py-2.5 text-left text-xs text-[#4B5563]"
          >
            Digest : aucun produit à écouter pour le moment
          </button>
        )}
        {(parcours.active || digest.active) && (
          <div className="mb-3 rounded-xl bg-[#1F5C2E] text-white px-3 py-2 text-xs font-medium flex items-center justify-between gap-2">
            <span className="truncate">
              {parcours.active
                ? `Parcours ${parcours.index + 1}/${parcours.total}`
                : `Digest ${digest.index + 1}/${digest.total}`}
              {" · "}
              {(parcours.active
                ? parcoursProducts[parcours.index]?.name
                : digestTourProducts[digest.index]?.name) || "…"}
            </span>
            <button
              type="button"
              className="shrink-0 underline"
              onClick={() => {
                if (parcours.active) parcours.stop()
                if (digest.active) digest.stop()
              }}
            >
              Stop
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="overflow-hidden">
                <div className="bg-muted gwa-skeleton rounded-2xl aspect-[4/3]" />
                <div className="pt-2 space-y-1">
                  <div className="h-3 bg-muted rounded gwa-skeleton" />
                  <div className="h-3 bg-muted rounded w-2/3 gwa-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">{searchTerm ? "Aucun resultat" : "Pas encore de produits"}</h3>
            <p className="text-muted-foreground text-sm mb-5">{searchTerm ? "Essayez d'autres mots-cles" : "Soyez le premier a vendre"}</p>
            {!searchTerm && <Link href="/publier"><Button className="rounded-xl bg-[#2F7D32]">Publier un produit</Button></Link>}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
              {filteredProducts.map((p, idx) => (
                <MarketplaceGridCard
                  key={p.id}
                  product={p}
                  listening={listeningId === p.id}
                  favorited={favorites.has(p.id)}
                  listenProps={productListenProps(p)}
                  onToggleFavorite={toggleFavorite}
                  onAddToCart={addToCart}
                  formatPrice={fmt}
                  imageQuality={imageQuality}
                  priority={idx < 4}
                  onPrefetch={(prod) =>
                    prefetchProduct(router, prod as Product & Record<string, unknown>)
                  }
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
