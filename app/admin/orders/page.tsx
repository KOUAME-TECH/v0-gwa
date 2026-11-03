"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  MoreHorizontal,
  Eye,
  ShoppingCart,
  RefreshCw,
  Truck,
  CheckCircle,
  XCircle,
  Package,
  AlertTriangle,
} from "lucide-react"
import { EscrowStepper } from "@/components/orders/escrow-stepper"
import {
  ORDER_LIFECYCLE,
  ORDER_LIFECYCLE_LABELS,
  deriveLifecycle,
} from "@/lib/orders/lifecycle"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Order {
  id: string
  order_number: string
  status: string
  payment_status: string
  escrow_status?: string | null
  payment_method?: string
  subtotal: number
  shipping_cost: number
  service_fee: number
  total_amount: number
  shipping_address?: string
  shipping_city?: string
  shipping_country?: string
  created_at: string
  lifecycle_status?: string | null
  confirmed_by_buyer_at?: string | null
  buyer: {
    id: string
    full_name: string
    email: string
    avatar_url?: string
  }
  seller: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPayment, setFilterPayment] = useState<string>("all")
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [history, setHistory] = useState<{ id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[]>([])
  const pageSize = 20

  useEffect(() => {
    fetchOrders()
  }, [filterStatus, filterPayment, page])

  useEffect(() => {
    if (!detailOrder) {
      setHistory([])
      return
    }
    fetch(`/api/admin/orders/${detailOrder.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHistory(data?.history || []))
      .catch(() => setHistory([]))
  }, [detailOrder])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: filterStatus,
        payment_status: filterPayment,
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/admin/orders?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOrders([])
        setTotalCount(0)
        setLoading(false)
        return
      }
      setOrders(data.orders || [])
      setTotalCount(data.total || 0)
    } catch {
      setOrders([])
    }
    setLoading(false)
  }

  const searchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: filterStatus,
        payment_status: filterPayment,
        page: "0",
        pageSize: String(pageSize),
        q: searchQuery.trim(),
      })
      const res = await fetch(`/api/admin/orders?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOrders([])
        setLoading(false)
        return
      }
      setOrders(data.orders || [])
      setTotalCount(data.total || 0)
      setPage(0)
    } catch {
      setOrders([])
    }
    setLoading(false)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Mise à jour impossible")
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      )
    } catch {
      alert("Erreur réseau")
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (order: Order) => {
    const lifecycle = deriveLifecycle(order)
    const variant =
      lifecycle === "cancelled" || lifecycle === "disputed"
        ? "destructive"
        : lifecycle === "pending"
          ? "secondary"
          : "default"
    return <Badge variant={variant}>{ORDER_LIFECYCLE_LABELS[lifecycle]}</Badge>
  }

  const getPaymentBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "En attente", variant: "secondary" },
      paid: { label: "Payé", variant: "default" },
      failed: { label: "Échoué", variant: "destructive" },
      refunded: { label: "Remboursé", variant: "outline" },
    }
    const config = statusConfig[status] || { label: status, variant: "secondary" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Commandes</h1>
          <p className="text-muted-foreground">{totalCount} commandes au total</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} className="bg-transparent">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro de commande..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchOrders()}
                  className="pl-9"
                />
              </div>
              <Button onClick={searchOrders}>Rechercher</Button>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {ORDER_LIFECYCLE.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORDER_LIFECYCLE_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="paid">Payés</SelectItem>
                  <SelectItem value="failed">Échoués</SelectItem>
                  <SelectItem value="refunded">Remboursés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune commande trouvée</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Acheteur</TableHead>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Escrow</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium font-mono">{order.order_number}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={order.buyer?.avatar_url || "/placeholder.svg"} />
                              <AvatarFallback>{order.buyer?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate max-w-[100px]">
                              {order.buyer?.full_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={order.seller?.avatar_url || "/placeholder.svg"} />
                              <AvatarFallback>{order.seller?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate max-w-[100px]">
                              {order.seller?.full_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(order)}</TableCell>
                        <TableCell>{getPaymentBadge(order.payment_status)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.escrow_status === "frozen"
                                ? "destructive"
                                : order.escrow_status === "held"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {order.escrow_status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDetailOrder(order)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir escrow / détails
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Changer le statut
                              </DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "paid")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Payée
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "processing")}>
                                <Package className="h-4 w-4 mr-2" />
                                En préparation
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "shipped")}>
                                <Truck className="h-4 w-4 mr-2" />
                                Expédiée
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "delivered")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Livrée
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "completed")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Réception confirmée
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "disputed")}>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Marquer litige
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => updateOrderStatus(order.id, "cancelled")}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Annuler
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Affichage de {page * pageSize + 1} à {Math.min((page + 1) * pageSize, totalCount)} sur {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="bg-transparent"
                  >
                    Précédent
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                    className="bg-transparent"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailOrder?.order_number || "Commande"}
            </DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Statut: <strong>{detailOrder.status}</strong> · Paiement:{" "}
                  <strong>{detailOrder.payment_status}</strong>
                </p>
                <p>
                  Montant:{" "}
                  <strong>{formatCurrency(detailOrder.total_amount)}</strong>
                </p>
                <p>
                  Acheteur: {detailOrder.buyer?.full_name} · Vendeur:{" "}
                  {detailOrder.seller?.full_name}
                </p>
              </div>
              <ol className="space-y-2 text-sm">
                {history.map((event) => (
                  <li key={event.id} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">
                      {event.from_status || "—"} → {event.to_status}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDate(event.created_at)}
                      {event.reason ? ` · ${event.reason}` : ""}
                    </p>
                  </li>
                ))}
                {history.length === 0 ? (
                  <li className="text-muted-foreground">Aucun historique pour l'instant.</li>
                ) : null}
              </ol>
              <Button
                variant="outline"
                onClick={async () => {
                  await fetch(`/api/admin/orders/${detailOrder.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      refund: true,
                      reason: "Remboursement depuis le suivi",
                    }),
                  })
                  setDetailOrder(null)
                  fetchOrders()
                }}
              >
                Annuler et marquer remboursé
              </Button>
              <EscrowStepper
                payment_status={detailOrder.payment_status}
                escrow_status={
                  detailOrder.escrow_status as
                    | "pending"
                    | "held"
                    | "released"
                    | "frozen"
                    | null
                    | undefined
                }
                status={detailOrder.status}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
