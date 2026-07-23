"use client"

import { useState, useEffect, useMemo, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, MapPin, Heart, X, ChevronLeft, ShoppingCart, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { toast } from "sonner"
import { ListenMicButton } from "@/components/media/clickable-listen-text"
import { buildProductListenText } from "@/lib/media/product-listen"
import { ShopVoiceTourButton } from "@/components/media/shop-voice-tour-button"
import { DigestBanner } from "@/components/media/digest-banner"
import { useShopVoiceTour } from "@/hooks/use-shop-voice-tour"
import { useRealtimeLocation } from "@/hooks/use-realtime-location"
import {
  digestSinceHours,
  filterDigestProducts,
} from "@/lib/products/digest"

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
  profiles: { full_name: string; avatar_url: string | null; is_verified: boolean } | null
  categories: { name: string; slug: string } | null
}

type Category = { id: string; name: string; slug: string; category_type: string }

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF6E5] p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <MarketplaceContent />
    </Suspense>
  )
}

function MarketplaceContent() {
  const searchParams = useSearchParams()
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
  } = useRealtimeLocation({ auto: true, maximumAge: 0 })
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

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
      .then(({ error }) => {
        if (error) console.warn("[marketplace] geo profile update", error.message)
      })
  }, [userId, geoCity, geoCountry, geoLabel, supabase])

  async function fetchData() {
    setIsLoading(true)
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
          profiles:seller_id(full_name, avatar_url, is_verified),
          categories:category_id(name, slug)
        `)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60)

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
    // Fusionner ids digest (hors top 60) + catalogue
    const byId = new Map<string, Product>()
    for (const p of [...digestExtra, ...catalog]) byId.set(p.id, p)
    setProducts([...byId.values()])
    if (categoriesRes.data) setCategories(categoriesRes.data)
    if (favsRes.data) setFavorites(new Set((favsRes.data as { product_id: string }[]).map(f => f.product_id)))
    // Profil = fallback si GPS pas encore autorisé
    if (!geoCity && profileRes.data?.city) setUserCity(profileRes.data.city)
    if (!geoCountry && profileRes.data?.country) setUserCountry(profileRes.data.country)
    setIsLoading(false)
  }

  async function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!userId) { toast.error("Connectez-vous pour ajouter aux favoris"); return }
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
    if (!userId) { toast.error("Connectez-vous pour ajouter au panier"); return }
    const { error } = await supabase.from("cart_items").upsert(
      { user_id: userId, product_id: id, quantity: 1 },
      { onConflict: "user_id,product_id" }
    )
    if (error) toast.error("Erreur ajout panier")
    else toast.success("Ajoute au panier")
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

  const digestProducts = useMemo(() => {
    const since = digestSinceHours(24)

    // Deep-link push Digest (?digest=1&ids=…)
    if (isDigest) {
      let list = products
      if (sinceParam) {
        const sinceMs = new Date(sinceParam).getTime()
        if (!Number.isNaN(sinceMs)) {
          list = list.filter((p) => {
            if (!p.created_at) return true
            const createdMs = new Date(p.created_at).getTime()
            return Number.isNaN(createdMs) || createdMs >= sinceMs
          })
        }
      }
      if (idsParam) {
        const ids = new Set(idsParam.split(",").filter(Boolean))
        if (ids.size > 0) list = list.filter((p) => ids.has(p.id))
      }
      return list
    }

    // Digest ≠ Parcours : nouveautés locales (région + 24h)
    const regional = filterDigestProducts(
      products,
      { id: userId || "anon", city: userCity, country: userCountry },
      since,
    )
    if (regional.length > 0) return regional

    // Fallback UI : les 5 plus récents (catalogue déjà trié) — pas le Parcours complet
    return products.slice(0, 5)
  }, [products, idsParam, isDigest, sinceParam, userCity, userCountry, userId])

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
    toast.message("Digest prêt. Tapez la bannière pour écouter.", { duration: 4000 })
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

  function ProductListenBtn({ p, size = "xs" as const }: { p: Product; size?: "xs" | "sm" }) {
    return (
      <ListenMicButton size={size} {...productListenProps(p)} />
    )
  }

  // ---- COMPACT CARD (3 cols) — image arrondie plein espace ----
  const listeningId =
    parcours.active
      ? parcours.currentProductId
      : digest.active
        ? digest.currentProductId
        : null

  // ---- GRID CARD (2 cols) — micro produit conservé ----
  function GridCard({ p }: { p: Product }) {
    const listening = listeningId === p.id
    return (
      <Link href={`/produit/${p.id}`} className="block active:scale-[0.98] transition-transform">
        <div
          className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#F3F4F6] to-[#E8E4DC] ring-1 ${
            listening ? "ring-2 ring-[#C27D10] shadow-md" : "ring-black/[0.04]"
          }`}
          style={{ aspectRatio: "4/5" }}
        >
          {p.images?.[0] ? (
            <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="50vw" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-3xl">{"📦"}</div>
          )}
          <button onClick={(e) => toggleFavorite(p.id, e)}
            className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Heart className={`h-4 w-4 ${favorites.has(p.id) ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
          </button>
          {p.is_organic && (
            <Badge className="absolute top-2 left-2 bg-[#2F7D32] text-white text-[10px] px-1.5 py-0.5">Bio</Badge>
          )}
        </div>
        <div className="pt-2.5 px-0.5">
          <div className="flex items-start gap-1">
            <p className="text-sm font-medium leading-tight line-clamp-2 flex-1 min-w-0">{p.name}</p>
            <ProductListenBtn p={p} size="sm" />
          </div>
          {p.profiles && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              {p.profiles.full_name}
              {p.profiles.is_verified && <span className="text-[#2F7D32]">{"✓"}</span>}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm font-bold text-red-600">{fmt(p.price)} <span className="text-[10px] font-normal text-gray-500">FCFA/{p.unit}</span></span>
            <button onClick={(e) => addToCart(p.id, e)}
              className="w-8 h-8 rounded-full bg-[#2F7D32] text-white flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 p-3">
          <Link href="/" className="lg:hidden"><ChevronLeft className="h-6 w-6" /></Link>
          <h1 className="text-lg font-semibold flex-1 text-[#111827]">Boutique</h1>
          <ShopVoiceTourButton
            active={parcours.active}
            index={parcours.index}
            total={parcours.total}
            onClick={handleParcoursClick}
            idleLabel="Parcours"
            className="shrink-0"
          />
          <Link href="/panier">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <ShoppingCart className="h-5 w-5 text-[#4B5563]" />
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="flex gap-2 px-3 pb-2">
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
            <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
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
        <div className="flex gap-1.5 overflow-x-auto gwa-no-scroll px-3 pb-2">
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
      <main className="p-4 sm:p-5">
        {/* Digest visible seulement via notification (?digest=1) — pas en permanence dans le shop */}
        {isDigest && digestProducts.length > 0 && (
          <DigestBanner
            count={digestProducts.length}
            city={userCity || geoCity || geoLabel}
            tourActive={digest.active}
            tourIndex={digest.index}
            tourTotal={digest.total}
            onStartTour={handleDigestClick}
          />
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
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
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
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((p) => (
                <GridCard key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
