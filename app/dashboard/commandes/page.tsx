"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Package, Truck, CheckCircle2, Clock, XCircle,
  Search, Eye, MapPin, Calendar,
  ArrowRight, RefreshCw, FileText, History, AlertTriangle,
  ShoppingBag,
} from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { EscrowStepper } from "@/components/orders/escrow-stepper"
import { LitigeDialog } from "@/components/orders/litige-dialog"
import {
  canBuyerConfirmReception,
  canOpenLitige,
  humanPaymentLabel,
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/escrow-flow"
import { cn } from "@/lib/utils"

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  shipping_address: string
  payment_method: string
  payment_status: string
  escrow_status?: string | null
  notes: string | null
  created_at: string
  updated_at: string
  seller_id: string
  buyer_id?: string
  seller?: {
    full_name: string
    company_name: string | null
  }
  order_items?: {
    id: string
    quantity: number
    unit_price: number
    product: {
      name: string
      unit: string
    }
  }[]
}

interface AuditLog {
  id: string
  action: string
  old_value: string | null
  new_value: string | null
  performed_by: string | null
  notes: string | null
  created_at: string
  profiles?: {
    full_name: string
  } | null
}

const orderStatuses: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: ORDER_STATUS_LABELS.draft, color: "bg-gray-500", icon: FileText },
  pending: { label: ORDER_STATUS_LABELS.pending, color: "bg-yellow-500", icon: Clock },
  confirmed: { label: ORDER_STATUS_LABELS.confirmed, color: "bg-blue-500", icon: CheckCircle2 },
  processing: { label: ORDER_STATUS_LABELS.processing, color: "bg-purple-500", icon: Package },
  shipped: { label: ORDER_STATUS_LABELS.shipped, color: "bg-orange-500", icon: Truck },
  delivered: { label: ORDER_STATUS_LABELS.delivered, color: "bg-green-500", icon: CheckCircle2 },
  cancelled: { label: ORDER_STATUS_LABELS.cancelled, color: "bg-red-500", icon: XCircle },
  disputed: { label: ORDER_STATUS_LABELS.disputed, color: "bg-red-600", icon: AlertTriangle },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [litigeOrderId, setLitigeOrderId] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (!user) {
      setLoading(false)
      return
    }

    // Load orders as buyer
    const { data: buyerOrders } = await supabase
      .from('orders')
      .select(`
        *,
        seller:seller_id (full_name, city),
        order_items (
          id,
          quantity,
          unit_price,
          product:product_id (name, unit)
        )
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    // Load orders as seller
    const { data: sellerOrders } = await supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id (full_name, city),
        order_items (
          id,
          quantity,
          unit_price,
          product:product_id (name, unit)
        )
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })

    const allOrders = [...(buyerOrders || []), ...(sellerOrders || [])]
    // Remove duplicates
    const uniqueOrders = allOrders.filter((order, index, self) =>
      index === self.findIndex(o => o.id === order.id)
    )

    setOrders(uniqueOrders)
    setLoading(false)
  }

  async function loadAuditLog(orderId: string) {
    setLoadingAudit(true)
    
    const { data } = await supabase
      .from("order_audit_log")
      .select(
        `
        id, action, old_value, new_value, notes, created_at, performed_by,
        profiles:performed_by (full_name)
      `,
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })

    if (data) {
      setAuditLogs(data as AuditLog[])
    }
    setLoadingAudit(false)
  }

  async function updateOrderStatus(orderId: string, newStatus: string, _reason?: string) {
    const order = orders.find((o) => o.id === orderId)
    if (!order || !user) return

    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Mise à jour impossible")
      return
    }
    toast.success("C’est noté. On avance.")
    loadOrders()
    if (selectedOrder?.id === orderId) loadAuditLog(orderId)
  }

  async function confirmReception(orderId: string) {
    let receptionPhotoUrl: string | undefined
    try {
      const pick = window.confirm(
        "Tu as bien reçu ? Tu peux ajouter une photo (recommandé), ou confirmer sans.",
      )
      if (!pick) return
      const wantPhoto = window.confirm("Ajouter une photo du colis ?")
      if (wantPhoto && user) {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/*"
        input.capture = "environment"
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] || null)
          input.click()
        })
        if (file && file.size < 8_000_000) {
          const path = `reception/${user.id}/${orderId}-${Date.now()}.jpg`
          const { error: upErr } = await supabase.storage
            .from("product-images")
            .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" })
          if (!upErr) {
            const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path)
            receptionPhotoUrl = pub?.publicUrl
          }
        }
      }
    } catch {
      /* continue without photo */
    }

    const res = await fetch(`/api/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receptionPhotoUrl }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "On n’a pas pu confirmer. Réessaie.")
      return
    }
    toast.success("Merci ! L’argent part chez le vendeur.")
    loadOrders()
  }

  function openLitige(orderId: string) {
    setLitigeOrderId(orderId)
  }

  const filteredOrders = orders.filter(order => 
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.order_items?.some(item => 
      item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const getStatusInfo = (status: string) => {
    const n = normalizeOrderStatus(status || "pending")
    return orderStatuses[n] || orderStatuses.pending
  }

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order)
    await loadAuditLog(order.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF6E5]">
        <Navigation />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-[#1F5C2E]/60" />
          <h1 className="font-display text-2xl text-[#1F5C2E]">Tes commandes t’attendent</h1>
          <p className="mt-2 text-[#4B5563]">
            Connecte-toi pour suivre ce que tu as acheté ou vendu.
          </p>
          <Button asChild className="mt-6 rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]">
            <Link href="/auth/login">Se connecter</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF6E5]">
      <Navigation />

      <div className="gwa-shell-wide w-full px-4 py-6 md:px-6 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-[#1F5C2E]">Mes commandes</h1>
            <p className="text-[#4B5563] mt-1 text-sm md:text-base">
              Suivi des achats et ventes.
            </p>
          </div>
          <Link href="/marketplace">
            <Button className="rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]">
              Continuer les courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Stats — une ligne claire, pas un dashboard froid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Toutes",
              value: orders.length,
              hint: "depuis le début",
            },
            {
              label: "En route",
              value: orders.filter((o) =>
                ["shipped", "shipping"].includes(normalizeOrderStatus(o.status)),
              ).length,
              hint: "bientôt chez toi",
            },
            {
              label: "Reçues",
              value: orders.filter((o) => o.status === "delivered").length,
              hint: "merci !",
            },
            {
              label: "En cours",
              value: orders.filter((o) =>
                ["pending", "confirmed", "processing", "shipped", "preparing", "shipping"].includes(
                  normalizeOrderStatus(o.status),
                ),
              ).length,
              hint: "à surveiller",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[#1F5C2E]/10 bg-white/80 px-4 py-3"
            >
              <p className="text-2xl font-semibold text-[#111827]">{s.value}</p>
              <p className="text-sm font-medium text-[#1F5C2E]">{s.label}</p>
              <p className="text-[11px] text-[#6B7280]">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <Input
              placeholder="Cherche un numéro ou un produit…"
              className="pl-10 h-11 rounded-xl border-[#E5E7EB] bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={loadOrders}
            aria-label="Actualiser"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="achats">
          <TabsList className="bg-white/80 border border-[#E5E7EB] rounded-xl h-auto flex-wrap p-1">
            <TabsTrigger value="achats" className="rounded-lg">
              Mes achats ({orders.filter((o) => o.seller_id !== user?.id).length})
            </TabsTrigger>
            <TabsTrigger value="ventes" className="rounded-lg">
              Mes ventes ({orders.filter((o) => o.seller_id === user?.id).length})
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg">
              Toutes ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-lg">
              En cours
            </TabsTrigger>
            <TabsTrigger value="delivered" className="rounded-lg">
              Reçues
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-lg">
              Annulées
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achats" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter((o) => o.seller_id !== user?.id)
                .map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
              {filteredOrders.filter((o) => o.seller_id !== user?.id).length === 0 ? (
                <p className="text-center text-sm text-[#6B7280] py-10">
                  Pas encore d’achat. Le marché t’attend.
                </p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="ventes" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter((o) => o.seller_id === user?.id)
                .map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
              {filteredOrders.filter((o) => o.seller_id === user?.id).length === 0 ? (
                <p className="text-center text-sm text-[#6B7280] py-10">
                  Aucune vente pour l’instant.
                </p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-white/60 px-6 py-14 text-center">
                <Package className="mx-auto mb-3 h-11 w-11 text-[#1F5C2E]/50" />
                <h3 className="font-display text-lg text-[#1F5C2E]">Pas encore de commande</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-[#6B7280]">
                  Quand tu achètes ou vends, le fil apparaît ici : paiement, route, réception.
                </p>
                <Button asChild className="mt-5 rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]">
                  <Link href="/marketplace">Parcourir le marché</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter(o => ["pending", "confirmed", "processing", "shipped", "preparing", "shipping"].includes(normalizeOrderStatus(o.status)))
                .map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="delivered" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter(o => o.status === "delivered")
                .map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="cancelled" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter(o => o.status === "cancelled")
                .map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmReception={confirmReception}
                    onOpenLitige={openLitige}
                    currentUserId={user?.id}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-[#1F5C2E]">
              {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#6B7280]">Où ça en est</p>
                    <Badge className={`${getStatusInfo(selectedOrder.status).color} text-white mt-1`}>
                      {getStatusInfo(selectedOrder.status).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-[#6B7280]">Total</p>
                    <p className="text-lg font-semibold">
                      {selectedOrder.total_amount.toLocaleString()} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6B7280]">Date</p>
                    <p>{new Date(selectedOrder.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6B7280]">Paiement</p>
                    <p>
                      {humanPaymentLabel(selectedOrder.payment_method, selectedOrder.payment_status)}
                    </p>
                  </div>
                </div>

                {(selectedOrder.payment_status === "paid" || !!selectedOrder.escrow_status) && (
                  <EscrowStepper
                    payment_status={selectedOrder.payment_status}
                    escrow_status={
                      selectedOrder.escrow_status as
                        | "pending"
                        | "held"
                        | "released"
                        | "frozen"
                        | null
                        | undefined
                    }
                    status={normalizeOrderStatus(selectedOrder.status)}
                    compact
                  />
                )}

                <div>
                  <h4 className="mb-2 font-semibold text-[#111827]">Dans le panier</h4>
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between rounded-xl bg-[#FFF6E5] p-3 text-sm"
                      >
                        <span>
                          {item.product?.name} ×{item.quantity}
                        </span>
                        <span className="font-medium">
                          {(item.quantity * item.unit_price).toLocaleString()} FCFA
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.shipping_address ? (
                  <div>
                    <h4 className="mb-2 font-semibold text-[#111827]">Livraison</h4>
                    <p className="text-sm text-[#4B5563]">{selectedOrder.shipping_address}</p>
                  </div>
                ) : null}

                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-[#111827]">
                    <History className="h-4 w-4" />
                    Ce qui s’est passé
                  </h4>

                  {loadingAudit ? (
                    <div className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[#1F5C2E]" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">Rien d’autre pour l’instant.</p>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="border-l-2 border-[#1F5C2E]/25 pl-3 text-sm"
                        >
                          <p>
                            <span className="font-medium">
                              {log.profiles?.full_name || "GWA"}
                            </span>
                            {log.old_value || log.new_value ? (
                              <>
                                {" "}
                                :{" "}
                                {log.old_value ? (
                                  <Badge variant="outline" className="mx-1">
                                    {getStatusInfo(log.old_value).label}
                                  </Badge>
                                ) : null}
                                {log.old_value && log.new_value ? " → " : null}
                                {log.new_value ? (
                                  <Badge variant="outline" className="mx-1">
                                    {getStatusInfo(log.new_value).label}
                                  </Badge>
                                ) : null}
                              </>
                            ) : (
                              <> : {log.action}</>
                            )}
                          </p>
                          {log.notes ? (
                            <p className="mt-1 text-[#6B7280]">{log.notes}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-[#9CA3AF]">
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <LitigeDialog
        orderId={litigeOrderId}
        open={!!litigeOrderId}
        onOpenChange={(open) => {
          if (!open) setLitigeOrderId(null)
        }}
        onSuccess={() => loadOrders()}
      />
    </div>
  )
}

function OrderCard({
  order,
  onViewDetails,
  onUpdateStatus,
  onConfirmReception,
  onOpenLitige,
  currentUserId,
}: {
  order: Order
  onViewDetails: () => void
  onUpdateStatus: (orderId: string, status: string, reason?: string) => void
  onConfirmReception: (orderId: string) => void
  onOpenLitige: (orderId: string) => void
  currentUserId?: string
}) {
  const status = normalizeOrderStatus(order.status)
  const statusInfo = orderStatuses[status] || orderStatuses.pending
  const StatusIcon = statusInfo.icon
  const isSeller = order.seller_id === currentUserId
  const canConfirmBuyer = canBuyerConfirmReception({
    isSeller,
    payment_status: order.payment_status,
    escrow_status: order.escrow_status as "pending" | "held" | "released" | "frozen" | null | undefined,
    status,
  })
  const canLitige = canOpenLitige({
    payment_status: order.payment_status,
    escrow_status: order.escrow_status as "pending" | "held" | "released" | "frozen" | null | undefined,
    status,
  })

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#1F5C2E]/10 bg-white/90 p-5 md:p-6",
        "hover:shadow-md transition-shadow",
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-semibold text-[#111827]">{order.order_number}</span>
              <Badge className={`${statusInfo.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              {isSeller && (
                <Badge variant="outline" className="border-[#1F5C2E]/30 text-[#1F5C2E]">
                  Tu vends
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[#6B7280] mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(order.created_at).toLocaleDateString("fr-FR")}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                {order.order_items?.length || 0} article
                {(order.order_items?.length || 0) > 1 ? "s" : ""}
              </span>
              {order.shipping_address ? (
                <span className="flex items-center gap-1 truncate max-w-[240px]">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {order.shipping_address}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {order.order_items?.slice(0, 3).map((item) => (
                <Badge key={item.id} variant="outline" className="font-normal">
                  {item.product?.name} ×{item.quantity}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col lg:items-end gap-3 lg:min-w-[220px]">
            <div className="lg:text-right">
              <p className="text-2xl font-semibold text-[#111827]">
                {order.total_amount.toLocaleString()}{" "}
                <span className="text-sm font-medium text-[#6B7280]">FCFA</span>
              </p>
              <p className="text-sm text-[#6B7280]">
                {humanPaymentLabel(order.payment_method, order.payment_status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-1" />
                Voir
              </Button>
              {isSeller && status === "pending" && (
                <>
                  <Button
                    size="sm"
                    className="rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]"
                    onClick={() => onUpdateStatus(order.id, "confirmed")}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Accepter
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onUpdateStatus(order.id, "cancelled")}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Refuser
                  </Button>
                </>
              )}
              {isSeller && status === "confirmed" && (
                <Button
                  size="sm"
                  className="rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]"
                  onClick={() => onUpdateStatus(order.id, "processing")}
                >
                  <Package className="h-4 w-4 mr-1" />
                  Je prépare
                </Button>
              )}
              {isSeller && status === "processing" && (
                <Button
                  size="sm"
                  className="rounded-xl bg-[#1F5C2E] hover:bg-[#184a25]"
                  onClick={() => onUpdateStatus(order.id, "shipped")}
                >
                  <Truck className="h-4 w-4 mr-1" />
                  C’est parti
                </Button>
              )}
              {canConfirmBuyer && (
                <Button
                  size="sm"
                  className="rounded-xl bg-[#1F5C2E] hover:bg-[#174a24]"
                  onClick={() => onConfirmReception(order.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  J’ai bien reçu
                </Button>
              )}
              {canLitige && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-red-600 border-red-200"
                  onClick={() => onOpenLitige(order.id)}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Un souci
                </Button>
              )}
            </div>
          </div>
        </div>
        {(order.payment_status === "paid" || !!order.escrow_status) && (
          <div className="mt-5 pt-5 border-t border-[#1F5C2E]/10">
            <EscrowStepper
              payment_status={order.payment_status}
              escrow_status={order.escrow_status as "pending" | "held" | "released" | "frozen" | null | undefined}
              status={status}
            />
          </div>
        )}
    </div>
  )
}
