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

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  shipping_address: string
  payment_method: string
  payment_status: string
  notes: string | null
  created_at: string
  updated_at: string
  seller_id: string
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
  old_status: string
  new_status: string
  changed_by: string
  change_reason: string | null
  ip_address: string | null
  created_at: string
  profiles?: {
    full_name: string
  }
}

const orderStatuses = {
  draft: { label: "Brouillon", color: "bg-gray-500", icon: FileText },
  pending: { label: "En attente", color: "bg-yellow-500", icon: Clock },
  confirmed: { label: "Confirmée", color: "bg-blue-500", icon: CheckCircle2 },
  preparing: { label: "En préparation", color: "bg-purple-500", icon: Package },
  shipping: { label: "En livraison", color: "bg-orange-500", icon: Truck },
  delivered: { label: "Livrée", color: "bg-green-500", icon: CheckCircle2 },
  cancelled: { label: "Annulée", color: "bg-red-500", icon: XCircle },
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
        seller:seller_id (full_name, company_name),
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
        buyer:buyer_id (full_name, company_name),
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

  async function updateOrderStatus(orderId: string, newStatus: string, reason?: string) {
    const order = orders.find(o => o.id === orderId)
    if (!order || !user) return

    // Update order
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (!error) {
      // Add audit log
      await supabase
        .from('order_audit_log')
        .insert({
          order_id: orderId,
          old_status: order.status,
          new_status: newStatus,
          changed_by: user.id,
          change_reason: reason
        })

      // Refresh orders
      loadOrders()
      if (selectedOrder?.id === orderId) {
        loadAuditLog(orderId)
      }
    }
  }

  const filteredOrders = orders.filter(order => 
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.order_items?.some(item => 
      item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const getStatusInfo = (status: string) => {
    return orderStatuses[status as keyof typeof orderStatuses] || orderStatuses.pending
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
                <p className="text-2xl font-bold">{orders.filter(o => ["pending", "confirmed", "preparing"].includes(o.status)).length}</p>
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
            <TabsTrigger value="active">En cours ({orders.filter(o => ["pending", "confirmed", "preparing", "shipping"].includes(o.status)).length})</TabsTrigger>
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
                    onUpdateStatus={updateOrderStatus}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-4">
              {filteredOrders
                .filter(o => ["pending", "confirmed", "preparing", "shipping"].includes(o.status))
                .map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onViewDetails={() => handleViewDetails(order)}
                    onUpdateStatus={updateOrderStatus}
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

function OrderCard({ order, onViewDetails, onUpdateStatus, currentUserId }: { 
  order: Order
  onViewDetails: () => void
  onUpdateStatus: (orderId: string, status: string, reason?: string) => void
  currentUserId?: string
}) {
  const statusInfo = orderStatuses[order.status as keyof typeof orderStatuses] || orderStatuses.pending
  const StatusIcon = statusInfo.icon
  const isSeller = order.seller_id === currentUserId

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Order Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-bold">{order.order_number}</span>
              <Badge className={`${statusInfo.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              {isSeller && (
                <Badge variant="outline">Vendeur</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(order.created_at).toLocaleDateString('fr-FR')}
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
              {(order.order_items?.length || 0) > 3 && (
                <Badge variant="outline">+{(order.order_items?.length || 0) - 3} autres</Badge>
              )}
            </div>
          </div>

          {/* Price and Actions */}
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold">{order.total_amount.toLocaleString()} FCFA</p>
              <p className="text-sm text-muted-foreground">
                {order.payment_method} - {order.payment_status}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-1" />
                Details
              </Button>
              
              {/* Seller actions */}
              {isSeller && order.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => onUpdateStatus(order.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Confirmer
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onUpdateStatus(order.id, "cancelled", "Refuse par le vendeur")}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Refuser
                  </Button>
                </>
              )}
              {isSeller && order.status === "confirmed" && (
                <Button size="sm" onClick={() => onUpdateStatus(order.id, "preparing")}>
                  <Package className="h-4 w-4 mr-1" />
                  En preparation
                </Button>
              )}
              {isSeller && order.status === "preparing" && (
                <Button size="sm" onClick={() => onUpdateStatus(order.id, "shipping")}>
                  <Truck className="h-4 w-4 mr-1" />
                  Expedier
                </Button>
              )}
              
              {/* Buyer actions */}
              {!isSeller && order.status === "shipping" && (
                <Button size="sm" onClick={() => onUpdateStatus(order.id, "delivered")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Recu
                </Button>
              )}
              
              <Button variant="outline" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                Contact
              </Button>
            </div>
          </div>
        </div>

        {/* Status Timeline for Active Orders */}
        {["confirmed", "preparing", "shipping"].includes(order.status) && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              {Object.entries(orderStatuses).slice(2, 6).map(([key, status], i) => {
                const StatusIcon = status.icon
                const statusOrder = ["confirmed", "preparing", "shipping", "delivered"]
                const currentIndex = statusOrder.indexOf(order.status)
                const isCompleted = statusOrder.indexOf(key) <= currentIndex
                const isCurrent = order.status === key
                
                return (
                  <div key={key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <span className={`text-xs mt-1 ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {status.label}
                      </span>
                    </div>
                    {i < 3 && (
                      <div className={`flex-1 h-0.5 mx-2 ${isCompleted && statusOrder.indexOf(key) < currentIndex ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
