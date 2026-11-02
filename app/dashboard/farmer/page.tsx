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
  Wallet,
  BadgeCheck,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { WeatherWidget } from "@/components/weather-widget"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"
import { isFactoringEligible } from "@/lib/factoring/eligibility"
import { getCoachActions } from "@/lib/scg/coach"
import { ScgCoachPanel } from "@/components/scg/scg-coach"
import type { SCGDimensions } from "@/lib/scg/engine"
import { EmptyState } from "@/components/ui/empty-state"
import { entitlementsForTier } from "@/lib/pricing/entitlements"
import { productDetailPath } from "@/lib/products/paths"
import { ESCROW_COPY } from "@/lib/copy/escrow-fr"
import {
  farmerOrderStatusLabel,
  isActiveSellerOrderStatus,
  resolveFarmerNextAction,
} from "@/lib/farmer/dashboard"
import { shouldPromptIdentityVerification } from "@/lib/verification/badge"
import { trackFarmerEvent } from "@/lib/farmer/observability"
import { flushPublishQueue } from "@/lib/offline/sync"
import { listPublishQueue } from "@/lib/offline/publish-queue"

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

type FarmerProfile = {
  full_name?: string | null
  subscription_tier?: string | null
  scg_score?: number | null
  scg_bancable?: boolean | null
  is_verified?: boolean | null
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

function escrowHint(status: string | null | undefined): string {
  if (status === "held") return ` · ${ESCROW_COPY.held}`
  if (status === "released") return ` · ${ESCROW_COPY.released}`
  if (status === "frozen") return ` · ${ESCROW_COPY.frozen}`
  return ""
}

export default function FarmerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<FarmerProfile | null>(null)
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
  const [kycPending, setKycPending] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        router.push("/auth/login?redirect=/dashboard/farmer")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, subscription_tier, scg_score, scg_bancable, is_verified")
        .eq("id", authUser.id)
        .single()
      setProfile((profileData as FarmerProfile) || null)

      const { data: productsData } = await supabase
        .from("products")
        .select(
          "id, name, price, unit, images, status, stock_quantity, seller_id, created_at",
        )
        .eq("seller_id", authUser.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
      setProducts((productsData as Product[]) || [])

      // Source de vérité ventes = orders.seller_id (pas order_items → products)
      const { data: ordersResult } = await supabase
        .from("orders")
        .select(
          "id, total_amount, status, escrow_status, created_at, profiles:buyer_id(full_name)",
        )
        .eq("seller_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(8)
      const ordersData = ((ordersResult as unknown as Order[]) || []).map((o) => ({
        ...o,
        profiles: Array.isArray(o.profiles) ? o.profiles[0] || null : o.profiles,
      }))
      setOrders(ordersData)
      setPendingOrders(
        ordersData.filter((o) => isActiveSellerOrderStatus(o.status)).length,
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

      const { data: kyc } = await supabase
        .from("verification_requests")
        .select("status")
        .eq("user_id", authUser.id)
        .eq("request_type", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      setKycPending(kyc?.status === "pending" || kyc?.status === "more_info_needed")

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

      try {
        const queued = await listPublishQueue(authUser.id)
        setPendingPublish(queued.length)
        if (queued.length > 0 && typeof navigator !== "undefined" && navigator.onLine) {
          await flushPublishQueue(authUser.id)
          const after = await listPublishQueue(authUser.id)
          setPendingPublish(after.length)
          trackFarmerEvent("farmer.publish.offline_queued", {
            flushed: queued.length - after.length,
            remaining: after.length,
          })
        }
      } catch {
        /* offline store optional */
      }

      trackFarmerEvent("farmer.dashboard.load", {
        products: (productsData as Product[] | null)?.length || 0,
        orders: ordersData.length,
        pending: ordersData.filter((o) => isActiveSellerOrderStatus(o.status)).length,
      })
      setIsLoading(false)
    }
    void fetchData()
  }, [router])

  useEffect(() => {
    const onOnline = () => {
      const supabase = createClient()
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return
        try {
          await flushPublishQueue(user.id)
          const after = await listPublishQueue(user.id)
          setPendingPublish(after.length)
        } catch {
          /* ignore */
        }
      })
    }
    if (typeof window === "undefined") return
    window.addEventListener("online", onOnline)
    window.addEventListener("gwa:online-sync", onOnline as EventListener)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("gwa:online-sync", onOnline as EventListener)
    }
  }, [])

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
  const showKycCta = shouldPromptIdentityVerification({
    is_verified: Boolean(profile?.is_verified),
    kyc_status: kycPending ? "pending" : profile?.is_verified ? "approved" : null,
  })
  const nextAction = resolveFarmerNextAction({
    productCount: products.length,
    pendingOrders,
    lowStockCount: lowStock.length,
    isVerified: Boolean(profile?.is_verified),
    kycPending,
    availableBalanceFcfa: sellerStats?.net_fcfa,
  })

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#FFF6E5] p-4 pb-24 space-y-4 animate-pulse"
        role="status"
        aria-label="Chargement espace producteur"
      >
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
      <a
        href="#farmer-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-[#1F5C2E]"
      >
        Aller au contenu producteur
      </a>
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
              href="/wallet"
              className="rounded-full bg-white p-2.5 ring-1 ring-[#1F5C2E]/15 min-h-11 min-w-11 inline-flex items-center justify-center"
              aria-label="Portefeuille"
            >
              <Wallet className="h-5 w-5 text-[#1F5C2E]" />
            </Link>
            <Link
              href="/abonnement"
              className="rounded-full bg-white p-2.5 ring-1 ring-[#1F5C2E]/15 min-h-11 min-w-11 inline-flex items-center justify-center"
              aria-label="Abonnement"
            >
              <Crown className="h-5 w-5 text-[#C27D10]" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button asChild className="flex-1 rounded-full bg-[#1F5C2E] hover:bg-[#174824] min-h-11">
            <Link href="/publier">
              <Plus className="mr-2 h-4 w-4" />
              Publier
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="relative flex-1 rounded-full border-[#1F5C2E]/30 min-h-11"
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
        <div className="mt-2 flex gap-2 text-xs">
          <Link
            href="/dashboard/reviews"
            className="min-h-11 inline-flex items-center font-medium text-[#1F5C2E] underline"
          >
            Mes avis
          </Link>
          <span className="text-[#9CA3AF]" aria-hidden>
            ·
          </span>
          <Link
            href="/dashboard/products"
            className="min-h-11 inline-flex items-center font-medium text-[#1F5C2E] underline"
          >
            Gérer les annonces
          </Link>
        </div>

        <div
          id="farmer-main"
          className="mt-3 rounded-xl bg-white/90 px-3 py-2.5 text-sm text-[#1F5C2E] ring-1 ring-[#1F5C2E]/15"
        >
          <Link href={nextAction.href} className="font-semibold underline">
            {nextAction.label}
          </Link>
        </div>

        {pendingPublish > 0 ? (
          <p className="mt-2 text-xs text-amber-800" role="status">
            {pendingPublish} publication{pendingPublish > 1 ? "s" : ""} en attente de
            synchronisation (hors-ligne).
          </p>
        ) : null}

        {showKycCta ? (
          <Link
            href="/profil/verification"
            className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-[#1F5C2E]/15"
          >
            <BadgeCheck className="h-4 w-4 text-[#1F5C2E]" />
            <span className="flex-1 font-medium text-[#1F5C2E]">
              Vérifie ton identité pour le badge
            </span>
            <ChevronRight className="h-4 w-4 text-[#6B7280]" />
          </Link>
        ) : null}

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

      <div className="px-4 mb-4 space-y-3">
        {showCoach && coachDims ? (
          <ScgCoachPanel
            score={coachScore || Number(profile?.scg_score || 0)}
            actions={getCoachActions(coachDims)}
          />
        ) : (
          <WeatherWidget />
        )}
        <div className="flex justify-end">
          <YellyAideButton source="farmer_dashboard" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 px-4" aria-label="Indicateurs vendeur">
        <Link
          href="/wallet"
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#1F5C2E]/8"
        >
          <p className="text-xs text-[#6B7280]">
            {statsLocked ? "Net (Starter+)" : "Net vendeur"}
          </p>
          {statsLocked ? (
            <span className="mt-1 block text-sm font-semibold text-[#1F5C2E]">
              Débloquer les stats →
            </span>
          ) : (
            <p className="mt-1 text-2xl font-bold text-[#1a1a1a]">
              {sellerStats ? formatFcfa(sellerStats.net_fcfa) : "—"}
            </p>
          )}
          <p className="mt-1 text-[11px] font-medium text-[#1F5C2E]">Portefeuille →</p>
        </Link>
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
            className="flex items-center gap-3 rounded-2xl bg-[#1F5C2E] px-4 py-3 text-white min-h-11"
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

      <section className="mt-6 px-4" aria-labelledby="farmer-orders-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="farmer-orders-heading" className="text-base font-semibold">
            À traiter
          </h2>
          <Link
            href="/dashboard/commandes"
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E] min-h-11"
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
                  className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-black/5 min-h-11"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {order.profiles?.full_name || "Acheteur"}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {formatFcfa(order.total_amount || 0)}
                      {escrowHint(order.escrow_status)}
                    </p>
                  </div>
                  <Badge variant="secondary">{farmerOrderStatusLabel(order.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 px-4 pb-8" aria-labelledby="farmer-products-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="farmer-products-heading" className="text-base font-semibold">
            Mes produits
          </h2>
          <Link
            href="/dashboard/products"
            className="flex items-center gap-0.5 text-xs font-medium text-[#1F5C2E] min-h-11"
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
                    className="text-[11px] font-medium text-amber-800 underline px-1 min-h-11 inline-flex items-center"
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
