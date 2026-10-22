// @ts-nocheck
"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, X, ArrowLeft, Heart, MapPin, BadgeCheck, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { sanitizeForQuery } from "@/lib/security/validation"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  origin_region: string | null
  ville?: string | null
  product_type: string
  profiles?: {
    full_name: string
    is_verified: boolean
  }
}

type Person = {
  id: string
  full_name: string
  avatar_url: string | null
  city: string | null
  is_verified: boolean
  user_type: string | null
}

const filters = [
  { value: "all", label: "Tout" },
  { value: "people", label: "Personnes" },
  { value: "agriculture", label: "Produits" },
]

function RechercheContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [activeFilter, setActiveFilter] = useState("all")
  const [products, setProducts] = useState<Product[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([])
  const [suggestedPeople, setSuggestedPeople] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const supabase = createClient()

  // Recommandations auto (vide / avant recherche)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: prods }, { data: verified }, { data: recent }] = await Promise.all([
        supabase
          .from("products")
          .select(
            `id, name, price, unit, images, origin_region, ville, product_type,
             profiles!products_seller_id_fkey(full_name, is_verified)`,
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, city, is_verified, user_type")
          .eq("is_verified", true)
          .not("full_name", "is", null)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, city, is_verified, user_type")
          .not("full_name", "is", null)
          .order("updated_at", { ascending: false })
          .limit(8),
      ])
      if (cancelled) return
      setSuggestedProducts((prods as Product[]) || [])
      const verifiedList = (verified as Person[]) || []
      const recentList = (recent as Person[]) || []
      // Priorité aux vérifiés, sinon personnes récentes (toujours afficher quelqu’un)
      const merged =
        verifiedList.length >= 3
          ? verifiedList
          : [
              ...verifiedList,
              ...recentList.filter((p) => !verifiedList.some((v) => v.id === p.id)),
            ].slice(0, 8)
      setSuggestedPeople(merged)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const search = useCallback(async () => {
    const q = sanitizeForQuery(query.trim())
    if (!q && activeFilter === "all") {
      setProducts([])
      setPeople([])
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    const wantProducts = activeFilter === "all" || activeFilter === "agriculture"
    const wantPeople = activeFilter === "all" || activeFilter === "people"

    const tasks: Promise<void>[] = []

    if (wantProducts) {
      tasks.push(
        (async () => {
          let qb = supabase
            .from("products")
            .select(
              `id, name, price, unit, images, origin_region, ville, product_type,
               profiles!products_seller_id_fkey(full_name, is_verified)`,
            )
            .eq("status", "active")
          if (q) {
            qb = qb.or(`name.ilike.%${q}%,ville.ilike.%${q}%,origin_region.ilike.%${q}%`)
          }
          if (activeFilter === "agriculture") {
            qb = qb.eq("product_type", "agriculture")
          }
          const { data } = await qb.order("created_at", { ascending: false }).limit(40)
          setProducts((data as Product[]) || [])
        })(),
      )
    } else {
      setProducts([])
    }

    if (wantPeople && q) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, city, is_verified, user_type")
            .or(`full_name.ilike.%${q}%,city.ilike.%${q}%`)
            .order("is_verified", { ascending: false })
            .limit(20)
          setPeople((data as Person[]) || [])
        })(),
      )
    } else if (wantPeople && !q) {
      setPeople(suggestedPeople)
    } else {
      setPeople([])
    }

    await Promise.all(tasks)
    setIsLoading(false)
  }, [supabase, query, activeFilter, suggestedPeople])

  useEffect(() => {
    const timer = setTimeout(() => {
      void search()
    }, 280)
    return () => clearTimeout(timer)
  }, [search])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      <header className="sticky top-0 z-40 bg-white/95 border-b border-[#E5E7EB] backdrop-blur-sm lg:static lg:bg-transparent lg:border-0">
        <div className="gwa-shell-wide flex items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/" className="p-2 -ml-2 active:opacity-60 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="search"
              placeholder="Produit, ville, ou quelqu’un…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-11 pl-10 pr-10 rounded-full bg-[#F3F4F6] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/25"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                aria-label="Effacer"
              >
                <X className="h-4 w-4 text-[#9CA3AF]" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="gwa-shell-wide flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none lg:px-6">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-[#1F5C2E] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      <div className="gwa-shell-wide px-4 py-5 lg:px-6 space-y-8">
        {!hasSearched ? (
          <>
            {suggestedPeople.length > 0 ? (
              <section>
                <h2 className="font-display text-base text-[#1F5C2E] mb-3">
                  Des gens à découvrir
                </h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                  {suggestedPeople.map((p) => (
                    <Link
                      key={p.id}
                      href={`/profil/${p.id}`}
                      className="shrink-0 w-28 rounded-2xl bg-white border border-[#E5E7EB] p-3 text-center active:scale-[0.98] transition"
                    >
                      <Avatar className="h-14 w-14 mx-auto mb-2">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#E8F0E9] text-[#1F5C2E]">
                          {(p.full_name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-semibold text-[#111827] truncate flex items-center justify-center gap-0.5">
                        {p.full_name?.split(" ")[0]}
                        {p.is_verified ? (
                          <BadgeCheck className="h-3 w-3 text-[#1F5C2E] shrink-0" />
                        ) : null}
                      </p>
                      <p className="text-[10px] text-[#6B7280] truncate">{p.city || "GWA"}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="font-display text-base text-[#1F5C2E] mb-3">
                Pour toi · nouveautés
              </h2>
              {suggestedProducts.length === 0 ? (
                <p className="text-sm text-[#6B7280]">
                  Les offres arrivent bientôt. En attendant, cherche un produit ou un nom.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {suggestedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-[#E5E7EB] mb-2" />
                <div className="h-4 bg-[#E5E7EB] rounded w-3/4 mb-1" />
              </div>
            ))}
          </div>
        ) : people.length === 0 && products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#E8F0E9] flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-[#1F5C2E]/50" />
            </div>
            <h3 className="font-semibold text-lg mb-1 text-[#111827]">Rien trouvé pour ça</h3>
            <p className="text-[#6B7280] text-sm mb-4">
              Essaie un autre mot, une ville, ou le prénom d’un producteur.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("")
                setActiveFilter("all")
              }}
              className="rounded-full"
            >
              Revenir aux suggestions
            </Button>
          </div>
        ) : (
          <>
            {people.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold text-[#4B5563] mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personnes ({people.length})
                </h2>
                <div className="space-y-2 mb-6">
                  {people.map((p) => (
                    <Link
                      key={p.id}
                      href={`/profil/${p.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-white border border-[#E5E7EB] px-3 py-2.5 hover:bg-[#FFF6E5] transition"
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#E8F0E9] text-[#1F5C2E]">
                          {(p.full_name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-[#111827] truncate flex items-center gap-1">
                          {p.full_name}
                          {p.is_verified ? (
                            <BadgeCheck className="h-3.5 w-3.5 text-[#1F5C2E]" />
                          ) : null}
                        </p>
                        <p className="text-xs text-[#6B7280] truncate">
                          {[p.city, p.user_type].filter(Boolean).join(" · ") || "Sur GWA"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {products.length > 0 ? (
              <section>
                <p className="text-sm text-[#6B7280] mb-3">
                  {products.length} offre{products.length > 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} formatPrice={formatPrice} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  formatPrice,
}: {
  product: Product
  formatPrice: (n: number) => string
}) {
  return (
    <Link href={`/produit/${product.id}`} className="group block">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#E8E4DC] mb-2 ring-1 ring-black/[0.04]">
        <Image
          src={product.images?.[0] || "/placeholder.svg"}
          alt={product.name}
          fill
          className="object-cover group-active:scale-105 transition-transform duration-300"
          sizes="(max-width:768px) 50vw, 25vw"
        />
        <button
          type="button"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
          onClick={(e) => e.preventDefault()}
          aria-label="Favori"
        >
          <Heart className="h-4 w-4 text-[#4B5563]" />
        </button>
        {product.profiles?.is_verified ? (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-0.5">
            <BadgeCheck className="h-3 w-3 text-[#1F5C2E]" />
            <span className="text-[10px] font-medium">Vérifié</span>
          </div>
        ) : null}
      </div>
      <h3 className="font-medium text-sm text-[#111827] truncate">{product.name}</h3>
      <p className="text-sm">
        <span className="font-semibold">{formatPrice(product.price)}</span>
        <span className="text-[#6B7280]"> FCFA/{product.unit}</span>
      </p>
      {(product.ville || product.origin_region) && (
        <p className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3" />
          {product.ville || product.origin_region}
        </p>
      )}
    </Link>
  )
}

export default function RecherchePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1F5C2E]/30 border-t-[#1F5C2E] rounded-full animate-spin" />
        </div>
      }
    >
      <RechercheContent />
    </Suspense>
  )
}
