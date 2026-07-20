"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, MapPin, Heart, X, ChevronLeft, Grid3X3, LayoutList, LayoutGrid, ShoppingCart, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  price: number
  unit: string
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
type ViewMode = "compact" | "list" | "grid"

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("compact")
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id || null)

    const [productsRes, categoriesRes, favsRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id, name, price, unit, images, origin_country, origin_region,
          is_organic, is_fair_trade, product_type, category_id, seller_id,
          profiles:seller_id(full_name, avatar_url, is_verified),
          categories:category_id(name, slug)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("categories").select("id, name, slug, category_type").eq("category_type", "agriculture").is("parent_id", null).order("name"),
      user ? supabase.from("favorites").select("product_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { product_id: string }[] })
    ])

    if (productsRes.data) setProducts(productsRes.data as Product[])
    if (categoriesRes.data) setCategories(categoriesRes.data)
    if (favsRes.data) setFavorites(new Set((favsRes.data as { product_id: string }[]).map(f => f.product_id)))
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === "all" || p.product_type === selectedType
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory
    return matchesSearch && matchesType && matchesCategory
  })

  const filteredCategories = categories.filter(c => selectedType === "all" || c.category_type === selectedType)
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
  const activeFiltersCount = (selectedType !== "all" ? 1 : 0) + (selectedCategory !== "all" ? 1 : 0)

  // ---- COMPACT CARD (3 cols) ----
  function CompactCard({ p }: { p: Product }) {
    return (
      <Link href={`/produit/${p.id}`} className="bg-white rounded-xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform">
        <div className="relative" style={{ aspectRatio: "1/1", maxHeight: 90 }}>
          {p.images?.[0] ? (
            <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="120px" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-2xl">{"📦"}</div>
          )}
          <button onClick={(e) => toggleFavorite(p.id, e)}
            className="absolute top-1 right-1 w-6 h-6 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Heart className={`h-3 w-3 ${favorites.has(p.id) ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
          </button>
        </div>
        <div className="p-1.5">
          <p className="text-[11px] font-medium leading-tight line-clamp-1">{p.name}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-bold text-red-600">{fmt(p.price)} F</span>
            <button onClick={(e) => addToCart(p.id, e)}
              className="w-[22px] h-[22px] rounded-full bg-[#2F7D32] text-white flex items-center justify-center shrink-0">
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Link>
    )
  }

  // ---- LIST CARD (1 per row) ----
  function ListCard({ p }: { p: Product }) {
    return (
      <Link href={`/produit/${p.id}`} className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-sm active:scale-[0.99] transition-transform" style={{ maxHeight: 74 }}>
        <div className="relative w-[58px] h-[58px] rounded-lg overflow-hidden shrink-0">
          {p.images?.[0] ? (
            <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="58px" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-xl">{"📦"}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-tight line-clamp-1">{p.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {p.categories && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{p.categories.name}</span>}
            {p.origin_region && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />{p.origin_region}
              </span>
            )}
          </div>
          <p className="text-[13px] font-bold text-red-600 mt-0.5">{fmt(p.price)} FCFA/{p.unit}</p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={(e) => addToCart(p.id, e)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2F7D32] text-white text-[10px] font-medium min-h-[28px]">
            <Plus className="h-3 w-3" />Ajouter
          </button>
          <button onClick={(e) => toggleFavorite(p.id, e)}
            className="flex items-center justify-center px-3 py-1.5 rounded-full border border-gray-200 min-h-[28px]">
            <Heart className={`h-3 w-3 ${favorites.has(p.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
          </button>
        </div>
      </Link>
    )
  }

  // ---- GRID CARD (2 cols) ----
  function GridCard({ p }: { p: Product }) {
    return (
      <Link href={`/produit/${p.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
        <div className="relative" style={{ aspectRatio: "4/3" }}>
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
            <Badge className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5">Bio</Badge>
          )}
        </div>
        <div className="p-2.5">
          <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
          {p.profiles && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              {p.profiles.full_name}
              {p.profiles.is_verified && <span className="text-blue-500">{"✓"}</span>}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm font-bold text-[#2F7D32]">{fmt(p.price)} <span className="text-[10px] font-normal text-gray-500">FCFA/{p.unit}</span></span>
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
          <h1 className="text-lg font-semibold flex-1 text-[#111827]">Marketplace</h1>
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

        {/* Quick filters + view toggle */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="flex gap-1.5 overflow-x-auto gwa-no-scroll flex-1">
            {[{ value: "all", label: "Tout" }, { value: "agriculture", label: "Agriculture" }].map(t => (
              <button key={t.value} onClick={() => { setSelectedType(t.value); setSelectedCategory("all") }}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${selectedType === t.value ? "bg-[#2F7D32] text-white" : "bg-white text-[#4B5563] border border-[#E5E7EB]"}`}>{t.label}</button>
            ))}
          </div>
          {/* View mode toggles */}
          <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
            {([
              { mode: "compact" as ViewMode, icon: Grid3X3 },
              { mode: "list" as ViewMode, icon: LayoutList },
              { mode: "grid" as ViewMode, icon: LayoutGrid },
            ]).map(({ mode, icon: Icon }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md ${viewMode === mode ? "bg-white shadow-sm" : ""}`} aria-label={mode}>
                <Icon className={`h-4 w-4 ${viewMode === mode ? "text-[#2F7D32]" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-3">
        {isLoading ? (
          <div className={`grid gap-2 ${viewMode === "compact" ? "grid-cols-3" : viewMode === "list" ? "grid-cols-1" : "grid-cols-2"}`}>
            {[...Array(viewMode === "compact" ? 9 : 6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden">
                <div className={`bg-muted gwa-skeleton ${viewMode === "list" ? "h-14 w-14" : viewMode === "compact" ? "aspect-square max-h-[90px]" : "aspect-[4/3]"}`} />
                {viewMode !== "list" && <div className="p-2 space-y-1"><div className="h-3 bg-muted rounded gwa-skeleton" /><div className="h-3 bg-muted rounded w-2/3 gwa-skeleton" /></div>}
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}</p>
              <Badge variant="outline" className="text-[10px] text-[#2F7D32] border-[#2F7D32]/30 capitalize">{viewMode}</Badge>
            </div>

            {viewMode === "compact" && (
              <div className="grid grid-cols-3 gap-2">
                {filteredProducts.map(p => <CompactCard key={p.id} p={p} />)}
              </div>
            )}

            {viewMode === "list" && (
              <div className="flex flex-col gap-2">
                {filteredProducts.map(p => <ListCard key={p.id} p={p} />)}
              </div>
            )}

            {viewMode === "grid" && (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredProducts.map(p => <GridCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
