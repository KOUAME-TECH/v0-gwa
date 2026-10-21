"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  Smartphone,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { isSellerRole } from "@/lib/dashboard/routing"

type SellerOrder = {
  id: string
  order_number: string
  status: string
  payment_status: string
  escrow_status: string | null
  payout_status: string | null
  total_amount: number
  vendeur_recoit_fcfa: number | null
  commission_fcfa: number | null
  service_fee: number | null
  created_at: string
}

type PayoutRequest = {
  id: string
  amount_fcfa: number
  network: string
  phone: string
  status: string
  payout_reference: string | null
  admin_notes: string | null
  created_at: string
  processed_at: string | null
}

type EarningsSummary = {
  orders_count: number
  paid_orders_count: number
  delivered_orders_count: number
  total_paid_sales: number
  sales_in_progress: number
  eligible_proceeds: number
  reserved_for_payout: number
  paid_out: number
  available_for_request: number
}

const PAGE_SIZE = 25
const NETWORKS = [
  { value: "orange_ci", label: "Orange Money" },
  { value: "mtn_ci", label: "MTN Money" },
  { value: "moov_ci", label: "Moov Money" },
  { value: "wave_ci", label: "Wave" },
] as const

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En traitement",
  paid: "Versé",
  failed: "Échec",
  cancelled: "Annulée",
  delivered: "Livrée",
  shipped: "Expédiée",
  shipping: "En livraison",
  preparing: "En préparation",
  confirmed: "Confirmée",
  pending_payment: "Paiement en attente",
  released: "Libéré",
  held: "Séquestre",
}

function currency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function statusBadge(status: string) {
  const variant =
    status === "paid" || status === "delivered" || status === "released"
      ? "default"
      : status === "failed" || status === "cancelled"
        ? "destructive"
        : "secondary"
  return <Badge variant={variant}>{STATUS_LABELS[status] || status}</Badge>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function sellerProceeds(order: SellerOrder) {
  if (order.vendeur_recoit_fcfa != null) return Number(order.vendeur_recoit_fcfa)
  return Math.max(
    0,
    Number(order.total_amount || 0) -
      Number(order.commission_fcfa || 0) -
      Number(order.service_fee || 0),
  )
}

export default function SellerEarningsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ user_type: string | null; phone: string | null } | null>(null)
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [payoutsTotal, setPayoutsTotal] = useState(0)
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false)
  const [loadingMorePayouts, setLoadingMorePayouts] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [phone, setPhone] = useState("")
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]["value"]>("orange_ci")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login?redirect=/wallet")
        return
      }
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type, phone")
        .eq("id", user.id)
        .maybeSingle()
      if (profileError) {
        setProfileLoadError("Impossible de vérifier votre profil pour le moment.")
        throw profileError
      }
      setProfileLoadError(null)
      setProfile(currentProfile)
      if (currentProfile?.phone) setPhone((currentPhone) => currentPhone || currentProfile.phone || "")

      const [earningsResponse, payoutResponse] = await Promise.all([
        fetch(`/api/seller/earnings?limit=${PAGE_SIZE}&offset=0`, { cache: "no-store" }),
        fetch(`/api/wallet/withdraw?limit=${PAGE_SIZE}&offset=0`, { cache: "no-store" }),
      ])
      const earningsData = await earningsResponse.json().catch(() => ({}))
      const payoutData = await payoutResponse.json().catch(() => ({}))
      if (!earningsResponse.ok) {
        throw new Error(earningsData.error || "Impossible de charger vos ventes.")
      }
      if (!payoutResponse.ok) {
        throw new Error(payoutData.error || "Impossible de charger vos demandes de versement.")
      }

      setOrders(earningsData.orders || [])
      setOrdersTotal(Number(earningsData.total || 0))
      setPayouts(payoutData.withdrawals || [])
      setPayoutsTotal(Number(payoutData.total || 0))
      setSummary(earningsData.summary || null)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  const loadMoreOrders = useCallback(async () => {
    if (loadingMoreOrders || orders.length >= ordersTotal) return
    setLoadingMoreOrders(true)
    try {
      const response = await fetch(
        `/api/seller/earnings?limit=${PAGE_SIZE}&offset=${orders.length}`,
        { cache: "no-store" },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Historique des ventes indisponible.")
      setOrders((current) => [...current, ...(data.orders || [])])
      setOrdersTotal(Number(data.total || 0))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
    } finally {
      setLoadingMoreOrders(false)
    }
  }, [loadingMoreOrders, orders.length, ordersTotal])

  const loadMorePayouts = useCallback(async () => {
    if (loadingMorePayouts || payouts.length >= payoutsTotal) return
    setLoadingMorePayouts(true)
    try {
      const response = await fetch(
        `/api/wallet/withdraw?limit=${PAGE_SIZE}&offset=${payouts.length}`,
        { cache: "no-store" },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Historique des versements indisponible.")
      setPayouts((current) => [...current, ...(data.withdrawals || [])])
      setPayoutsTotal(Number(data.total || 0))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.")
    } finally {
      setLoadingMorePayouts(false)
    }
  }, [loadingMorePayouts, payouts.length, payoutsTotal])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const available = Number(summary?.available_for_request || 0)

  const submitRequest = async () => {
    const amountValue = Number(amount)
    if (!Number.isSafeInteger(amountValue) || amountValue < 1000) {
      setError("Le montant minimum est de 1 000 FCFA.")
      return
    }
    if (amountValue > available) {
      setError("Le montant dépasse vos revenus disponibles.")
      return
    }
    if (!phone.trim()) {
      setError("Renseignez le numéro à créditer.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_fcfa: amountValue,
          phone: phone.trim(),
          network,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Demande impossible.")
      setRequestOpen(false)
      setAmount("")
      toast.success("Demande enregistrée. Le versement sera traité manuellement.")
      await loadData(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Demande impossible.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-muted-foreground">Chargement de vos ventes…</p>
      </main>
    )
  }

  if (profileLoadError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Profil indisponible</CardTitle>
            <CardDescription role="alert">{profileLoadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!isSellerRole(profile?.user_type)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Suivi des ventes</CardTitle>
            <CardDescription>Cette page est réservée aux producteurs et vendeurs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href="/dashboard/commandes">Voir mes commandes</Link></Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8 pb-24">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Mes ventes et versements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez vos commandes et demandez un versement traité manuellement par GWA.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponible sur ventes livrées</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{currency(available)}</span>
            <Wallet className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventes payées</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{currency(Number(summary?.total_paid_sales || 0))}</span>
            <ArrowDownLeft className="h-6 w-6 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commandes en cours</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{currency(Number(summary?.sales_in_progress || 0))}</span>
            <Clock3 className="h-6 w-6 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Déjà versé</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{currency(Number(summary?.paid_out || 0))}</span>
            <CheckCircle2 className="h-6 w-6 text-blue-600" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Versements traités manuellement</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Une demande ne déclenche pas un paiement automatique. L’équipe GWA la vérifiera puis mettra son statut à jour.
            </p>
          </div>
          <Button onClick={() => { setError(null); setRequestOpen(true) }} disabled={available < 1000}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Demander un versement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Toutes mes commandes ({summary?.orders_count ?? ordersTotal})
          </CardTitle>
          <CardDescription>
            Le statut de paiement et celui de livraison sont affichés séparément.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Aucune vente pour le moment</p>
              <p className="mt-1 text-sm text-muted-foreground">Vos commandes apparaîtront ici avec leur statut réel.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold">{order.order_number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Votre part : {currency(sellerProceeds(order))}</span>
                    <span className="mr-2 text-xs text-muted-foreground">
                      Commande : {currency(Number(order.total_amount))}
                    </span>
                    {statusBadge(order.payment_status)}
                    {statusBadge(order.status)}
                    {order.payout_status && statusBadge(order.payout_status)}
                  </div>
                </div>
              ))}
              {orders.length < ordersTotal && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadMoreOrders()}
                  disabled={loadingMoreOrders}
                >
                  {loadingMoreOrders ? "Chargement…" : `Afficher plus (${ordersTotal - orders.length} restantes)`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Demandes de versement ({payoutsTotal})
          </CardTitle>
          <CardDescription>Les demandes en attente ou en traitement sont déduites du montant disponible.</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande de versement.</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold">{currency(Number(payout.amount_fcfa))} · {payout.network.replace("_ci", "").toUpperCase()}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {payout.phone} · {formatDate(payout.created_at)}
                    </p>
                    {payout.payout_reference && (
                      <p className="mt-1 text-xs text-muted-foreground">Référence : {payout.payout_reference}</p>
                    )}
                    {payout.admin_notes && (
                      <p className="mt-1 text-sm text-muted-foreground">{payout.admin_notes}</p>
                    )}
                  </div>
                  {statusBadge(payout.status)}
                </div>
              ))}
              {payouts.length < payoutsTotal && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadMorePayouts()}
                  disabled={loadingMorePayouts}
                >
                  {loadingMorePayouts ? "Chargement…" : `Afficher plus (${payoutsTotal - payouts.length} restantes)`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={requestOpen} onOpenChange={(open) => { setRequestOpen(open); if (!open) setError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un versement manuel</DialogTitle>
            <DialogDescription>
              Disponible : {currency(available)}. Votre demande sera vérifiée par l’équipe GWA ; aucun paiement automatique n’est lancé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Montant (FCFA)</Label>
              <Input
                id="payout-amount"
                type="number"
                inputMode="numeric"
                min={1000}
                max={available}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum : 1 000 FCFA</p>
            </div>
            <div className="space-y-2">
              <Label>Réseau de réception</Label>
              <div className="grid grid-cols-2 gap-2">
                {NETWORKS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={network === item.value ? "default" : "outline"}
                    onClick={() => setNetwork(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-phone">Numéro Mobile Money</Label>
              <Input
                id="payout-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="07 XX XX XX XX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={() => void submitRequest()} disabled={submitting}>
              {submitting ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
