"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Search, X, ArrowLeft, Heart, MapPin, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  origin_region: string | null
  product_type: string
  profiles?: {
    full_name: string
    is_verified: boolean
  }
}

const filters = [
  { value: "all", label: "Tout" },
  { value: "agriculture", label: "Agriculture" },
  { value: "artisanat", label: "Artisanat" },
]

const trending = ["Cacao", "Café", "Mangue", "Tissage", "Karité", "Miel"]

export default function RecherchePage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  
  const [query, setQuery] = useState(initialQuery)
  const [activeFilter, setActiveFilter] = useState("all")
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const supabase = createClient()

  const search = useCallback(async () => {
    if (!query && activeFilter === "all") {
      setProducts([])
      setHasSearched(false)
      return
    }
    
    setIsLoading(true)
    setHasSearched(true)
    
    let queryBuilder = supabase
      .from("products")
      .select(`
        id, name, price, unit, images, origin_region, product_type,
        profiles!products_seller_id_fkey(full_name, is_verified)
      `)
      .eq("status", "active")

    if (query) {
      queryBuilder = queryBuilder.ilike("name", `%${query}%`)
    }

    if (activeFilter !== "all") {
      queryBuilder = queryBuilder.eq("product_type", activeFilter)
    }

    const { data } = await queryBuilder.order("created_at", { ascending: false }).limit(50)
    
    setProducts(data || [])
    setIsLoading(false)
  }, [supabase, query, activeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      search()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="p-2 -ml-2 active:opacity-60">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-10 pl-10 pr-10 rounded-full bg-neutral-100 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
            />
            {query && (
              <button 
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4">
        {!hasSearched ? (
          // Initial state - show trending
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 mb-3">Tendances</h2>
            <div className="flex flex-wrap gap-2">
              {trending.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-4 py-2 rounded-full border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-95 transition"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : isLoading ? (
          // Loading state
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-neutral-100 mb-2" />
                <div className="h-4 bg-neutral-100 rounded w-3/4 mb-1" />
                <div className="h-4 bg-neutral-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          // Empty state
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-neutral-400" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Aucun resultat</h3>
            <p className="text-neutral-500 text-sm mb-4">
              Essayez un autre terme de recherche
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setQuery(""); setActiveFilter("all"); }}
              className="rounded-full bg-transparent"
            >
              Effacer
            </Button>
          </div>
        ) : (
          // Results grid
          <>
            <p className="text-sm text-neutral-500 mb-4">
              {products.length} resultat{products.length > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <Link 
                  key={product.id} 
                  href={`/produit/${product.id}`}
                  className="group"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 mb-2">
                    <Image
                      src={product.images?.[0] || "/placeholder.svg"}
                      alt={product.name}
                      fill
                      className="object-cover group-active:scale-105 transition-transform duration-300"
                    />
                    <button 
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Heart className="h-4 w-4 text-neutral-600" />
                    </button>
                    {product.profiles?.is_verified && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-0.5">
                        <BadgeCheck className="h-3 w-3 text-[#2F7D32]" />
                        <span className="text-[10px] font-medium text-[#111827]">Verifie</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-neutral-900 truncate">{product.name}</h3>
                  <p className="text-sm">
                    <span className="font-semibold">{formatPrice(product.price)}</span>
                    <span className="text-neutral-500"> FCFA/{product.unit}</span>
                  </p>
                  {product.origin_region && (
                    <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {product.origin_region}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
