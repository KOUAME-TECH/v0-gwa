"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Package, Truck, CheckCircle2, Clock, XCircle,
  Search, Filter, Eye, MessageCircle, MapPin, Calendar,
  ArrowRight, RefreshCw, FileText, History, User, AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { EscrowStepper } from "@/components/orders/escrow-stepper"
import {
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/escrow-flow"

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
  ip_address: string | null
  created_at: string
  profiles?: {
    full_name: string
  }
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
      .from('order_audit_log')
      .select(`
        *,
        profiles:changed_by (full_name)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (data) {
      setAuditLogs(data)
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
    toast.success("Statut mis à jour")
    loadOrders()
    if (selectedOrder?.id === orderId) loadAuditLog(orderId)
  }

  async function confirmReception(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Confirmation impossible")
      return
    }
    toast.success("Réception confirmée — fonds libérés")
    loadOrders()
  }

  async function openLitige(orderId: string) {
    const description = window.prompt("Décris le problème (litige) :")
    if (!description?.trim()) return
    const res = await fetch(`/api/orders/${orderId}/litige`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: description.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Litige impossible")
      return
    }
    toast.success("Litige ouvert — fonds gelés")
    loadOrders()
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connexion requise</h3>
            <p className="text-muted-foreground mb-4">
              Connectez-vous pour voir vos commandes
            </p>
            <Link href="/auth/login">
              <Button>Se connecter</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mes Commandes</h1>
            <p className="text-muted-foreground">Suivez et gerez toutes vos commandes</p>
          </div>
          <Link href="/agriculture">
            <Button>
              Nouvelle commande
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-muted-foreground">Total commandes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.filter(o => o.status === "shipping").length}</p>
                <p className="text-sm text-muted-foreground">En livraison</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.filter(o => o.status === "delivered").length}</p>
                <p className="text-sm text-muted-foreground">Livrées</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.filter(o => ["pending", "confirmed", "processing", "shipped", "preparing", "shipping"].includes(normalizeOrderStatus(o.status))).length}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numero ou produit..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtrer
          </Button>
          <Button variant="outline" size="icon" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Orders Tabs */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Toutes ({orders.length})</TabsTrigger>
            <TabsTrigger value="active">En cours ({orders.filter(o => ["pending", "confirmed", "processing", "shipped", "preparing", "shipping"].includes(normalizeOrderStatus(o.status))).length})</TabsTrigger>
            <TabsTrigger value="delivered">Livrées ({orders.filter(o => o.status === "delivered").length})</TabsTrigger>
            <TabsTrigger value="cancelled">Annulées ({orders.filter(o => o.status === "cancelled").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {filteredOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune commande</h3>
                <p className="text-muted-foreground mb-4">
                  Vos commandes apparaîtront ici
                </p>
                <Link href="/agriculture">
                  <Button>Explorer les produits</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    .onUpdateStatus={updateOrderStatus}
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
                    .onUpdateStatus={updateOrderStatus}
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
                    .onUpdateStatus={updateOrderStatus}
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
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Commande {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <Badge className={`${getStatusInfo(selectedOrder.status).color} text-white mt-1`}>
                      {getStatusInfo(selectedOrder.status).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">{selectedOrder.total_amount.toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p>{new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paiement</p>
                    <p>{selectedOrder.payment_method} - {selectedOrder.payment_status}</p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-semibold mb-2">Articles</h4>
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map((item) => (
                      <div key={item.id} className="flex justify-between p-2 bg-muted rounded">
                        <span>{item.product?.name} x{item.quantity}</span>
                        <span className="font-medium">{(item.quantity * item.unit_price).toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping */}
                <div>
                  <h4 className="font-semibold mb-2">Adresse de livraison</h4>
                  <p className="text-muted-foreground">{selectedOrder.shipping_address}</p>
                </div>

                {/* Audit Log */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historique des modifications
                  </h4>
                  
                  {loadingAudit ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucune modification enregistree</p>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
                          <div className="flex-1">
                            <p>
                              <span className="font-medium">{log.profiles?.full_name || 'Systeme'}</span>
                              {' '}a change le statut de{' '}
                              <Badge variant="outline" className="mx-1">{getStatusInfo(log.old_status).label}</Badge>
                              {' '}vers{' '}
                              <Badge variant="outline" className="mx-1">{getStatusInfo(log.new_status).label}</Badge>
                            </p>
                            {log.change_reason && (
                              <p className="text-muted-foreground mt-1">Raison: {log.change_reason}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
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
  const canConfirmBuyer =
    !isSeller &&
    order.payment_status === "paid" &&
    ["shipped", "processing", "confirmed"].includes(status) &&
    order.escrow_status !== "released" &&
    order.escrow_status !== "frozen"
  const canLitige =
    status !== "disputed" &&
    status !== "cancelled" &&
    status !== "delivered" &&
    order.payment_status === "paid"

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-bold">{order.order_number}</span>
              <Badge className={`${statusInfo.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              {isSeller && <Badge variant="outline">Vendeur</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(order.created_at).toLocaleDateString("fr-FR")}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                {order.order_items?.length || 0} article(s)
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {order.shipping_address}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {order.order_items?.slice(0, 3).map((item) => (
                <Badge key={item.id} variant="outline">
                  {item.product?.name} x{item.quantity}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold">{order.total_amount.toLocaleString()} FCFA</p>
              <p className="text-sm text-muted-foreground">
                {order.payment_method} — {order.payment_status}
                {order.escrow_status ? ` · ${order.escrow_status}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-1" />
                Détails
              </Button>
              {isSeller && status === "pending" && (
                <>
                  <Button size="sm" onClick={() => onUpdateStatus(order.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Confirmer
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onUpdateStatus(order.id, "cancelled")}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Refuser
                  </Button>
                </>
              )}
              {isSeller && status === "confirmed" && (
                <Button size="sm" onClick={() => onUpdateStatus(order.id, "processing")}>
                  <Package className="h-4 w-4 mr-1" />
                  En préparation
                </Button>
              )}
              {isSeller && status === "processing" && (
                <Button size="sm" onClick={() => onUpdateStatus(order.id, "shipped")}>
                  <Truck className="h-4 w-4 mr-1" />
                  Expédier
                </Button>
              )}
              {canConfirmBuyer && (
                <Button size="sm" className="bg-[#1F5C2E] hover:bg-[#174a24]" onClick={() => onConfirmReception(order.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Confirmer réception
                </Button>
              )}
              {canLitige && (
                <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={() => onOpenLitige(order.id)}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Litige
                </Button>
              )}
            </div>
          </div>
        </div>
        {(order.payment_status === "paid" || !!order.escrow_status) && (
          <div className="mt-5 pt-5 border-t">
            <EscrowStepper
              payment_status={order.payment_status}
              escrow_status={order.escrow_status as "pending" | "held" | "released" | "frozen" | null | undefined}
              status={status}
              compact
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
