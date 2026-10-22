// @ts-nocheck
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
  MapPin,
  AlertCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { EmptyState } from "@/components/ui/empty-state"
import { productDetailPath } from "@/lib/products/paths"
import { ESCROW_COPY } from "@/lib/copy/escrow-fr"

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

interface NearbyProduct {
  id: string
  name: string
  price: number
  unit: string
  images: string[]
  ville?: string | null
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5
}

export default function BuyerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<{
    full_name?: string
    user_type?: string
    city?: string | null
  } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [nearby, setNearby] = useState<NearbyProduct | null>(null)
  const [popular, setPopular] = useState<NearbyProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null)

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
        .select("full_name, user_type, city")
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

      let productsQuery = supabase
        .from("products")
        .select("id, name, price, unit, images, ville")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8)

      if (profileData?.city) {
        const { data: nearData } = await supabase
          .from("products")
          .select("id, name, price, unit, images, ville")
          .eq("status", "active")
          .ilike("ville", `%${profileData.city}%`)
          .limit(1)
          .maybeSingle()
        if (nearData) setNearby(nearData as NearbyProduct)
      }

      const { data: pop } = await productsQuery
      setPopular((pop as NearbyProduct[]) || [])

      setIsLoading(false)
    }
    void fetchData()
  }, [router])

  const firstName = (profile?.full_name || "toi").split(" ")[0]
  const isEnterprise =
    profile?.user_type === "entreprise" || profile?.user_type === "business"
  const activeStatuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "preparing",
    "shipping",
  ]
  const inProgress = orders.filter((o) => activeStatuses.includes(o.status))
  const toConfirm = orders.filter(
    (o) =>
      o.escrow_status === "held" ||
      o.status === "shipped" ||
      o.status === "shipping",
  )
  const heldOver48 = toConfirm.filter(
    (o) => o.escrow_status === "held" && hoursSince(o.created_at) >= 48,
  )
  const hasDelivered = orders.some((o) => o.status === "delivered")
  const showFirstOrderChecklist = orders.length === 0 || !hasDelivered

  async function confirmReception(orderId: string) {
    setConfirmBusy(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Confirmation impossible")
        return
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "delivered",
                escrow_status: data.escrow_status || o.escrow_status,
              }
            : o,
        ),
      )
    } catch {
      alert("Erreur réseau")
    } finally {
      setConfirmBusy(null)
    }
  }

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
        <p className="text-sm font-medium text-[#C27D10]">
          {isEnterprise ? "Desk achats" : "Espace acheteur"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F5C2E]">
          Bonjour {firstName}
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {isEnterprise
            ? "Volumes, fournisseurs et commandes B2B."
            : "Suis tes achats et continue sur le marché."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="flex-1 rounded-full bg-[#1F5C2E] hover:bg-[#174824]">
            <Link href="/marketplace">
              <Store className="mr-2 h-4 w-4" />
              Continuer mes achats
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-[#1F5C2E]/30">
            <Link href="/dashboard/commandes">Commandes</Link>
          </Button>
          {isEnterprise ? (
            <Button asChild variant="outline" className="rounded-full border-[#C27D10]/40 text-[#C27D10]">
              <Link href="/contact">Demander devis Enterprise</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {heldOver48.length > 0 ? (
        <div className="mx-4 mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {ESCROW_COPY.heldOver48h}
            </p>
            <Link
              href="/dashboard/commandes"
              className="mt-1 inline-block text-xs font-medium text-[#1F5C2E] underline"
            >
              {ESCROW_COPY.buyerConfirmCta}
            </Link>
          </div>
        </div>
      ) : null}

      {toConfirm.length > 0 ? (
        <section className="mx-4 mb-4 space-y-2">
          <h2 className="text-base font-semibold text-[#1F5C2E]">À confirmer</h2>
          {toConfirm.slice(0, 3).map((o) => {
            const name =
              o.order_items?.[0]?.products?.name || "Commande"
            return (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#1F5C2E]/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-[#6B7280]">
                    {formatFcfa(Number(o.total_amount) || 0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 rounded-full bg-[#1F5C2E] hover:bg-[#174824]"
                  disabled={confirmBusy === o.id}
                  onClick={() => void confirmReception(o.id)}
                >
                  {confirmBusy === o.id ? "…" : "J’ai reçu"}
                </Button>
              </div>
            )
          })}
          {toConfirm.length > 3 ? (
            <Link
              href="/dashboard/commandes"
              className="block text-center text-xs font-medium text-[#1F5C2E] underline"
            >
              Voir toutes ({toConfirm.length})
            </Link>
          ) : null}
        </section>
      ) : null}

      {showFirstOrderChecklist ? (
        <section className="mx-4 mb-4 rounded-2xl bg-white p-4 ring-1 ring-[#1F5C2E]/10">
          <p className="text-sm font-semibold text-[#1F5C2E]">Première commande</p>
          <ol className="mt-2 space-y-2 text-sm text-[#4B5563]">
            <li className="flex items-center gap-2">
              <Badge variant="secondary">1</Badge>
              <Link href="/marketplace" className="underline">
                Explorer le marché
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary">2</Badge>
              <Link href="/panier" className="underline">
                Remplir le panier
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary">3</Badge>
              Payer — {ESCROW_COPY.protected.toLowerCase()} jusqu’à confirmation
            </li>
          </ol>
        </section>
      ) : null}

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

      {nearby ? (
        <section className="mt-6 px-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-base font-semibold">
            <MapPin className="h-4 w-4 text-[#1F5C2E]" />
            Près de toi
            {profile?.city ? (
              <span className="text-xs font-normal text-[#6B7280]">({profile.city})</span>
            ) : null}
          </h2>
          <Link
            href={productDetailPath(nearby.id)}
            className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5"
          >
            <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#F3F4F6]">
              {nearby.images?.[0] ? (
                <Image src={nearby.images[0]} alt="" fill className="object-cover" sizes="56px" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nearby.name}</p>
              <p className="text-xs font-semibold text-[#1F5C2E]">
                {formatFcfa(nearby.price)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
          </Link>
        </section>
      ) : null}

      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a1a1a]">À faire</h2>
          <Link
            href="/dashboard/commandes"
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E]"
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
              const name = order.order_items?.[0]?.products?.name || "Commande"
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
                        {needsConfirm ? ` · ${ESCROW_COPY.held}` : ""}
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
          <h2 className="text-base font-semibold">
            {favorites.length > 0 ? "Favoris" : "Pour toi"}
          </h2>
          <Link
            href={favorites.length > 0 ? "/favoris" : "/marketplace"}
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E]"
          >
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {favorites.length === 0 ? (
          popular.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Pas encore de favoris"
              description="Enregistre des produits pour les retrouver vite."
              actionLabel="Explorer le marché"
              actionHref="/marketplace"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {popular.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={productDetailPath(p.id)}
                  className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5"
                >
                  <div className="relative aspect-square bg-[#F3F4F6]">
                    {p.images?.[0] ? (
                      <Image
                        src={p.images[0]}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="50vw"
                      />
                    ) : null}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs font-semibold text-[#1F5C2E]">
                      {formatFcfa(p.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )
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
                  <p className="text-xs font-semibold text-[#1F5C2E]">
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
