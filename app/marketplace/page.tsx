"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, MapPin, Heart, X, ChevronLeft } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  origin_country: string
  origin_region: string | null
  is_verified: boolean
  product_type: string
  category_id: string | null
  profiles: { full_name: string; avatar_url: string | null } | null
  categories: { name: string; slug: string } | null
}

type Category = {
  id: string
  name: string
  slug: string
  category_type: string
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    
    const [productsRes, categoriesRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id, name, price, unit, images, origin_country, origin_region, 
          is_verified, product_type, category_id,
          profiles:seller_id(full_name, avatar_url),
          categories:category_id(name, slug)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("categories")
        .select("id, name, slug, category_type")
        .is("parent_id", null)
        .order("name")
    ])

    if (productsRes.data) setProducts(productsRes.data as Product[])
    if (categoriesRes.data) setCategories(categoriesRes.data)
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === "all" || p.product_type === selectedType
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory
    return matchesSearch && matchesType && matchesCategory
  })

  const filteredCategories = categories.filter(c => 
    selectedType === "all" || c.category_type === selectedType
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price)
  }

  const activeFiltersCount = (selectedType !== "all" ? 1 : 0) + (selectedCategory !== "all" ? 1 : 0)

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 p-4">
          <Link href="/" className="lg:hidden">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-semibold flex-1 text-[#111827]">Marketplace</h1>
        </div>
        
        {/* Barre de recherche */}
        <div className="flex gap-2 px-4 pb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-0 h-10 rounded-xl"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 relative shrink-0 rounded-xl border-0 bg-muted/50">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
              <SheetHeader className="pb-4">
                <SheetTitle>Filtres</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "all", label: "Tout" },
                      { value: "agriculture", label: "Agriculture" },
                      { value: "artisanat", label: "Artisanat" },
                    ].map(type => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setSelectedType(type.value)
                          setSelectedCategory("all")
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedType === type.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">Categorie</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      Toutes
                    </button>
                    {filteredCategories.slice(0, 15).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl h-12 bg-transparent"
                    onClick={() => {
                      setSelectedType("all")
                      setSelectedCategory("all")
                    }}
                  >
                    Reinitialiser
                  </Button>
                  <Button 
                    className="flex-1 rounded-xl h-12"
                    onClick={() => setShowFilters(false)}
                  >
                    Voir {filteredProducts.length} resultats
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Filtres rapides */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {[
            { value: "all", label: "Tout" },
            { value: "agriculture", label: "Agriculture" },
            { value: "artisanat", label: "Artisanat" },
          ].map(type => (
            <button
              key={type.value}
              onClick={() => {
                setSelectedType(type.value)
                setSelectedCategory("all")
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedType === type.value
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </header>

      {/* Contenu */}
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
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "Aucun resultat" : "Pas encore de produits"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {searchTerm 
                ? "Essayez avec d'autres mots-cles"
                : "Soyez le premier a vendre sur GWA"
              }
            </p>
            {!searchTerm && (
              <Link href="/publier">
                <Button className="rounded-xl">Publier un produit</Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
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
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-4xl">📦</span>
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        toggleFavorite(product.id)
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center"
                    >
                      <Heart 
                        className={`h-4 w-4 ${favorites.has(product.id) ? "fill-red-500 text-red-500" : "text-foreground"}`} 
                      />
                    </button>

                    {product.is_verified && (
                      <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                        Verifie
                      </Badge>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                      {product.name}
                    </h3>
                    
                    {product.origin_region && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{product.origin_region}</span>
                      </div>
                    )}
                    
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-[#2F7D32]">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-xs text-[#4B5563]">
                        FCFA/{product.unit}
                      </span>
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
