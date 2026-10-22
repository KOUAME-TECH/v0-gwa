// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Plus,
  Crown,
  ChevronRight,
  Banknote,
  Eye,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { WeatherWidget } from "@/components/weather-widget"
import { isFactoringEligible } from "@/lib/factoring/eligibility"
import { getCoachActions } from "@/lib/scg/coach"
import { ScgCoachPanel } from "@/components/scg/scg-coach"
import type { SCGDimensions } from "@/lib/scg/engine"
import { EmptyState } from "@/components/ui/empty-state"
import { entitlementsForTier } from "@/lib/pricing/entitlements"
import { productDetailPath } from "@/lib/products/paths"

interface Product {
  id: string
  name: string
  price: number
  unit: string
  stock_quantity: number
  images: string[]
  status: string
}

interface Order {
  id: string
  total_amount: number
  status: string
  escrow_status?: string | null
  created_at: string
  profiles: { full_name: string } | null
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

export default function FarmerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState(0)
  const [coachDims, setCoachDims] = useState<SCGDimensions | null>(null)
  const [coachScore, setCoachScore] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sellerStats, setSellerStats] = useState<{
    net_fcfa: number
    product_views: number
  } | null>(null)
  const [statsLocked, setStatsLocked] = useState(false)

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
        .select("*")
        .eq("id", authUser.id)
        .single()
      setProfile(profileData)

      const { data: productsData } = await supabase
        .from("products")
        .select(
          "id, name, price, unit, images, status, stock_quantity, seller_id, created_at",
        )
        .eq("seller_id", authUser.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
      setProducts((productsData as Product[]) || [])

      const productIds = (productsData || []).map((p: { id: string }) => p.id)
      let ordersData: Order[] = []
      if (productIds.length > 0) {
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("order_id")
          .in("product_id", productIds)
        const orderIds = [
          ...new Set((orderItems || []).map((oi: { order_id: string }) => oi.order_id)),
        ]
        if (orderIds.length > 0) {
          const { data: ordersResult } = await supabase
            .from("orders")
            .select("id, total_amount, status, escrow_status, created_at, profiles:buyer_id(full_name)")
            .in("id", orderIds)
            .order("created_at", { ascending: false })
            .limit(8)
          ordersData = (ordersResult as Order[]) || []
        }
      }
      setOrders(ordersData)
      setPendingOrders(
        ordersData.filter((o) =>
          ["pending", "confirmed", "processing", "shipping", "shipped"].includes(
            o.status,
          ),
        ).length,
      )

      const { data: scg } = await supabase
        .from("scg_scores")
        .select(
          "score_total, dim_fiabilite, dim_qualite, dim_engagement, dim_volumes, dim_stabilite",
        )
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (scg) {
        setCoachScore(scg.score_total || 0)
        setCoachDims({
          fiabilite: scg.dim_fiabilite || 0,
          qualite: scg.dim_qualite || 0,
          engagement: scg.dim_engagement || 0,
          volumes: scg.dim_volumes || 0,
          stabilite: scg.dim_stabilite || 0,
        })
      }

      try {
        const statsRes = await fetch("/api/seller/stats")
        const statsJson = await statsRes.json().catch(() => ({}))
        if (statsRes.ok && statsJson.stats) {
          setSellerStats({
            net_fcfa: statsJson.stats.net_fcfa || 0,
            product_views: statsJson.stats.product_views || 0,
          })
          setStatsLocked(false)
        } else if (statsRes.status === 403) {
          setStatsLocked(true)
        }
      } catch {
        /* ignore */
      }

      setIsLoading(false)
    }
    void fetchData()
  }, [router])

  const firstName = String(profile?.full_name || "Producteur").split(" ")[0]
  const tier = String(profile?.subscription_tier || "free")
  const entitlements = entitlementsForTier(tier)
  const showFactoring =
    profile &&
    isFactoringEligible({
      scg_score: Number(profile.scg_score || coachScore || 0),
      scg_bancable: Boolean(profile.scg_bancable),
    })
  const showCoach = Boolean(coachDims && entitlements.scgAdvanced)
  const lowStock = products.filter(
    (p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 5,
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] p-4 pb-24 space-y-4 animate-pulse">
        <div className="h-10 w-56 rounded bg-[#1F5C2E]/15" />
        <div className="h-16 rounded-2xl bg-white/70" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-white/70" />
          <div className="h-24 rounded-2xl bg-white/70" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F5E9] to-[#FFF6E5] pb-24">
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#C27D10]">Espace producteur</p>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F5C2E]">
              {firstName}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Publie, vends, suis l’argent qui arrive.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/abonnement"
              className="rounded-full bg-white p-2.5 ring-1 ring-[#1F5C2E]/15"
              aria-label="Abonnement"
            >
              <Crown className="h-5 w-5 text-[#C27D10]" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button asChild className="flex-1 rounded-full bg-[#1F5C2E] hover:bg-[#174824]">
            <Link href="/publier">
              <Plus className="mr-2 h-4 w-4" />
              Publier
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="relative flex-1 rounded-full border-[#1F5C2E]/30"
          >
            <Link href="/dashboard/commandes">
              Commandes
              {pendingOrders > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C27D10] px-1.5 text-[10px] font-bold text-white">
                  {pendingOrders}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>

        {/* P1 — prochaine action unique */}
        <div className="mt-3 rounded-xl bg-white/90 px-3 py-2.5 text-sm text-[#1F5C2E] ring-1 ring-[#1F5C2E]/15">
          {products.length === 0 ? (
            <Link href="/publier" className="font-semibold underline">
              Prochaine étape : publie ta première annonce
            </Link>
          ) : pendingOrders > 0 ? (
            <Link href="/dashboard/commandes" className="font-semibold underline">
              Prochaine étape : traite {pendingOrders} commande
              {pendingOrders > 1 ? "s" : ""}
            </Link>
          ) : lowStock.length > 0 ? (
            <Link href="/dashboard/products" className="font-semibold underline">
              Prochaine étape : mets à jour le stock ({lowStock.length})
            </Link>
          ) : (
            <Link href="/dashboard/products" className="font-semibold underline">
              Prochaine étape : partage ta boutique
            </Link>
          )}
        </div>

        {entitlements.tier === "free" ? (
          <Link
            href="/abonnement"
            className="mt-3 block rounded-xl bg-[#C27D10]/10 px-3 py-2.5 text-sm ring-1 ring-[#C27D10]/25"
          >
            <p className="font-semibold text-[#92400E]">Passe Starter</p>
            <p className="text-xs text-[#6B7280]">
              Débloque stats vendeur + 40 requêtes Yelly / jour + boost catalogue
            </p>
          </Link>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
          <Badge variant="secondary" className="capitalize">
            {entitlements.tier}
          </Badge>
          <span>
            Yelly{" "}
            {entitlements.yellyRequestsPerDay == null
              ? "illimité"
              : `${entitlements.yellyRequestsPerDay}/j`}
          </span>
        </div>
      </header>

      <div className="px-4 mb-4">
        {showCoach && coachDims ? (
          <ScgCoachPanel
            score={coachScore || Number(profile?.scg_score || 0)}
            actions={getCoachActions(coachDims)}
          />
        ) : (
          <WeatherWidget />
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 px-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#1F5C2E]/8">
          <p className="text-xs text-[#6B7280]">
            {statsLocked ? "Net (Starter+)" : "Net vendeur"}
          </p>
          {statsLocked ? (
            <Link href="/abonnement" className="mt-1 block text-sm font-semibold text-[#1F5C2E]">
              Débloquer les stats →
            </Link>
          ) : (
            <p className="mt-1 text-2xl font-bold text-[#1a1a1a]">
              {sellerStats ? formatFcfa(sellerStats.net_fcfa) : "—"}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/products"
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#1F5C2E]/8"
        >
          <p className="text-xs text-[#6B7280]">Produits</p>
          <p className="mt-1 text-2xl font-bold">{products.length}</p>
          {lowStock.length > 0 ? (
            <p className="text-[11px] text-amber-700">{lowStock.length} stock bas</p>
          ) : null}
        </Link>
      </section>

      {showFactoring ? (
        <section className="mt-4 px-4">
          <Link
            href="/affacturage"
            className="flex items-center gap-3 rounded-2xl bg-[#1F5C2E] px-4 py-3 text-white"
          >
            <Banknote className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Affacturage disponible</p>
              <p className="text-xs text-white/80">Demande un avance sur commande</p>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">À traiter</h2>
          <Link
            href="/dashboard/commandes"
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E]"
          >
            Tout voir <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Pas encore de commandes"
            description="Partage ton annonce pour démarrer les ventes."
            actionLabel="Voir mes produits"
            actionHref="/dashboard/products"
          />
        ) : (
          <ul className="space-y-2">
            {orders.slice(0, 4).map((order) => (
              <li key={order.id}>
                <Link
                  href="/dashboard/commandes"
                  className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-black/5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {order.profiles?.full_name || "Acheteur"}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {formatFcfa(order.total_amount || 0)}
                      {order.escrow_status === "held"
                        ? " · en séquestre"
                        : order.escrow_status === "released"
                          ? " · libéré"
                          : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{order.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 px-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Mes produits</h2>
          <Link
            href="/dashboard/products"
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E]"
          >
            Gérer <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Aucune annonce active"
            description={`Palier ${entitlements.tier} — publie ta première annonce.`}
            actionLabel="Publier"
            actionHref="/publier"
          />
        ) : (
          <ul className="space-y-2">
            {products.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link
                  href={productDetailPath(p.id)}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#F3F4F6]">
                    {p.images?.[0] ? (
                      <Image src={p.images[0]} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <Package className="m-3 h-6 w-6 text-[#9CA3AF]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-[#6B7280]">
                      {formatFcfa(p.price)} · stock {p.stock_quantity ?? 0}
                    </p>
                  </div>
                  {(p.stock_quantity ?? 0) <= 5 ? (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Stock bas
                    </Badge>
                  ) : null}
                </Link>
                {(p.stock_quantity ?? 0) <= 5 ? (
                  <Link
                    href={`/dashboard/products/${p.id}/edit`}
                    className="text-[11px] font-medium text-amber-800 underline px-1"
                  >
                    Maj stock
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {sellerStats && !statsLocked ? (
          <p className="mt-3 flex items-center gap-1 text-xs text-[#6B7280]">
            <Eye className="h-3.5 w-3.5" />
            {sellerStats.product_views} vues (période stats)
          </p>
        ) : null}
      </section>
    </div>
  )
}
