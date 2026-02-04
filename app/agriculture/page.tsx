"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Leaf, MapPin, Search, Heart, SlidersHorizontal, ChevronLeft, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  origin_country: string
  origin_region: string | null
  is_verified: boolean
  profiles: { full_name: string } | null
  categories: { name: string } | null
}

const categories = [
  { name: "Tout", icon: "🌍", slug: "all" },
  { name: "Cereales", icon: "🌾", slug: "cereales" },
  { name: "Cacao", icon: "🍫", slug: "cacao" },
  { name: "Cafe", icon: "☕", slug: "cafe" },
  { name: "Fruits", icon: "🥭", slug: "fruits" },
  { name: "Legumes", icon: "🥬", slug: "legumes" },
  { name: "Epices", icon: "🌶", slug: "epices" },
  { name: "Elevage", icon: "🐄", slug: "elevage" }
]

export default function AgriculturePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select(`
        id, name, price, unit, images, origin_country, origin_region, is_verified,
        profiles:seller_id(full_name),
        categories:category_id(name)
      `)
      .eq("status", "active")
      .eq("product_type", "agriculture")
      .order("created_at", { ascending: false })
      .limit(50)

    if (data) setProducts(data as Product[])
    setIsLoading(false)
  }

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      CI: "🇨🇮", GH: "🇬🇭", SN: "🇸🇳", BJ: "🇧🇯", ML: "🇲🇱", BF: "🇧🇫", NG: "🇳🇬", CM: "🇨🇲"
    }
    return flags[code] || "🌍"
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1a472a]">
        <div className="px-4 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-white/80">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Leaf className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Agriculture</h1>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white border-0 rounded-xl"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" className="h-11 w-11 bg-white/20 hover:bg-white/30 rounded-xl">
                  <SlidersHorizontal className="h-4 w-4 text-white" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[50vh] rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Filtres</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <p className="text-sm text-muted-foreground">Filtres a venir...</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Categories scrollables */}
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.slug
                  ? "bg-white text-[#1a472a]"
                  : "bg-white/20 text-white"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Products */}
      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Leaf className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "Aucun resultat" : "Pas encore de produits"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {searchQuery 
                ? "Essayez avec d'autres mots-cles"
                : "Soyez le premier producteur sur GWA"
              }
            </p>
            <Link href="/publier">
              <Button className="rounded-xl">Vendre mes produits</Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""} agricole{filteredProducts.length > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map(product => (
                <Link 
                  key={product.id} 
                  href={`/produit/${product.id}`}
                  className="bg-card rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="relative aspect-square bg-muted">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0] || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        toggleFavorite(product.id)
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"
                    >
                      <Heart className={`h-4 w-4 ${favorites.has(product.id) ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
                    </button>
                    {product.is_verified && (
                      <Badge className="absolute top-2 left-2 bg-primary text-[10px] px-1.5 py-0.5">
                        Verifie
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <span>{getCountryFlag(product.origin_country)}</span>
                      <span className="truncate">{product.origin_region || product.profiles?.full_name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-primary">{formatPrice(product.price)}</span>
                      <span className="text-xs text-muted-foreground">FCFA/{product.unit}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
