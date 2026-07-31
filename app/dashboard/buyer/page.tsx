"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  ChevronRight,
  Heart,
  Store,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { EmptyState } from "@/components/ui/empty-state"
import { productDetailPath } from "@/lib/products/paths"

interface Order {
  id: string
  total_amount: number
  status: string
  escrow_status?: string | null
  created_at: string
  order_items: {
    products: {
      name: string
      images: string[]
      profiles: { full_name: string } | null
    } | null
  }[]
}

interface Favorite {
  id: string
  product: {
    id: string
    name: string
    price: number
    unit: string
    images: string[]
    profiles: { full_name: string } | null
  }
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

export default function BuyerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ full_name?: string } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/auth/login")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, user_type")
        .eq("id", authUser.id)
        .single()
      setProfile(profileData)

      const { data: ordersData } = await supabase
        .from("orders")
        .select(
          `
          id, total_amount, status, escrow_status, created_at,
          order_items(products(name, images, profiles:seller_id(full_name)))
        `,
        )
        .eq("buyer_id", authUser.id)
        .order("created_at", { ascending: false })
      setOrders((ordersData as Order[]) || [])

      const { data: favoritesData } = await supabase
        .from("favorites")
        .select(
          `
          id,
          product:product_id(id, name, price, unit, images, profiles:seller_id(full_name))
        `,
        )
        .eq("user_id", authUser.id)
        .limit(4)
      setFavorites((favoritesData as Favorite[]) || [])

      setIsLoading(false)
    }
    void fetchData()
  }, [router])

  const firstName = (profile?.full_name || "toi").split(" ")[0]
  const activeStatuses = ["pending", "confirmed", "processing", "shipped", "preparing", "shipping"]
  const inProgress = orders.filter((o) => activeStatuses.includes(o.status))
  const toConfirm = orders.filter(
    (o) =>
      o.escrow_status === "held" ||
      ["shipped", "shipping", "delivered"].includes(o.status),
  ).filter((o) => o.escrow_status === "held" || o.status === "shipped" || o.status === "shipping")

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] p-4 pb-24 space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-[#1F5C2E]/10" />
        <div className="h-20 rounded-2xl bg-white/80" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-white/80" />
          <div className="h-24 rounded-2xl bg-white/80" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white pb-24">
      <header className="px-4 pt-6 pb-4">
        <p className="text-sm font-medium text-[#C27D10]">Espace acheteur</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F5C2E]">
          Bonjour {firstName}
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Suis tes achats et continue sur le marché.
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild className="flex-1 rounded-full bg-[#1F5C2E] hover:bg-[#174824]">
            <Link href="/marketplace">
              <Store className="mr-2 h-4 w-4" />
              Continuer mes achats
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-[#1F5C2E]/30">
            <Link href="/dashboard/commandes">Commandes</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-4">
        <Link
          href="/dashboard/commandes"
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#1F5C2E]/8"
        >
          <Package className="h-5 w-5 text-[#1F5C2E]" />
          <p className="mt-2 text-2xl font-bold text-[#1a1a1a]">{inProgress.length}</p>
          <p className="text-xs text-[#6B7280]">En cours</p>
        </Link>
        <Link
          href="/dashboard/commandes"
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#1F5C2E]/8"
        >
          <CheckCircle2 className="h-5 w-5 text-[#C27D10]" />
          <p className="mt-2 text-2xl font-bold text-[#1a1a1a]">{toConfirm.length}</p>
          <p className="text-xs text-[#6B7280]">À confirmer</p>
        </Link>
      </section>

      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a1a1a]">À faire</h2>
          <Link
            href="/dashboard/commandes"
            className="text-xs font-medium text-[#1F5C2E] flex items-center gap-0.5"
          >
            Tout voir <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {toConfirm.length === 0 && inProgress.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Aucune commande en cours"
            description="Explore le marché pour trouver des produits près de chez toi."
            actionLabel="Explorer le marché"
            actionHref="/marketplace"
          />
        ) : (
          <ul className="space-y-2">
            {(toConfirm.length > 0 ? toConfirm : inProgress).slice(0, 4).map((order) => {
              const name =
                order.order_items?.[0]?.products?.name || "Commande"
              const needsConfirm = order.escrow_status === "held"
              return (
                <li key={order.id}>
                  <Link
                    href="/dashboard/commandes"
                    className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5"
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#F3F4F6]">
                      {order.order_items?.[0]?.products?.images?.[0] ? (
                        <Image
                          src={order.order_items[0].products.images[0]}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <Package className="m-3 h-6 w-6 text-[#9CA3AF]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-xs text-[#6B7280]">
                        {formatFcfa(order.total_amount || 0)}
                      </p>
                    </div>
                    {needsConfirm ? (
                      <Badge className="bg-[#C27D10] text-white hover:bg-[#C27D10]">
                        Confirmer
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{order.status}</Badge>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 px-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Favoris</h2>
          <Link
            href="/favoris"
            className="text-xs font-medium text-[#1F5C2E] flex items-center gap-0.5"
          >
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Pas encore de favoris"
            description="Enregistre des produits pour les retrouver vite."
            actionLabel="Explorer le marché"
            actionHref="/marketplace"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={productDetailPath(f.product.id)}
                className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5"
              >
                <div className="relative aspect-square bg-[#F3F4F6]">
                  {f.product.images?.[0] ? (
                    <Image
                      src={f.product.images[0]}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="50vw"
                    />
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium">{f.product.name}</p>
                  <p className="text-xs text-[#1F5C2E] font-semibold">
                    {formatFcfa(f.product.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
