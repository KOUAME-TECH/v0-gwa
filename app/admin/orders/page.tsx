"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
} from "lucide-react"

interface Order {
  id: string
  order_number: string
  status: string
  payment_status: string
  payment_method?: string
  subtotal: number
  shipping_cost: number
  service_fee: number
  total_amount: number
  shipping_address?: string
  shipping_city?: string
  shipping_country?: string
  created_at: string
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
  const pageSize = 20

  useEffect(() => {
    fetchOrders()
  }, [filterStatus, filterPayment, page])

  const fetchOrders = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("orders")
      .select(`
        *,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email, avatar_url),
        seller:profiles!orders_seller_id_fkey(id, full_name, avatar_url)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus)
    }

    if (filterPayment !== "all") {
      query = query.eq("payment_status", filterPayment)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setOrders(data.map(o => ({
        ...o,
        buyer: Array.isArray(o.buyer) ? o.buyer[0] : o.buyer,
        seller: Array.isArray(o.seller) ? o.seller[0] : o.seller
      })) as Order[])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const searchOrders = async () => {
    if (!searchQuery.trim()) {
      fetchOrders()
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email, avatar_url),
        seller:profiles!orders_seller_id_fkey(id, full_name, avatar_url)
      `)
      .ilike("order_number", `%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setOrders(data.map(o => ({
        ...o,
        buyer: Array.isArray(o.buyer) ? o.buyer[0] : o.buyer,
        seller: Array.isArray(o.seller) ? o.seller[0] : o.seller
      })) as Order[])
    }
    setLoading(false)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const supabase = createClient()
    const { data: { user: adminUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("orders")
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)

    if (!error) {
      // Log the action
      await supabase.from("admin_logs").insert({
        admin_id: adminUser?.id,
        action: "update_order_status",
        entity_type: "order",
        entity_id: orderId,
        new_data: { status: newStatus },
      })

      // Add to order audit log
      await supabase.from("order_audit_log").insert({
        order_id: orderId,
        performed_by: adminUser?.id,
        action: "status_change",
        new_value: newStatus,
        notes: "Mise à jour par administrateur",
      })

      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ))
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Brouillon", variant: "outline" },
      pending: { label: "En attente", variant: "secondary" },
      confirmed: { label: "Confirmée", variant: "default" },
      processing: { label: "En préparation", variant: "default" },
      shipped: { label: "Expédiée", variant: "default" },
      delivered: { label: "Livrée", variant: "outline" },
      cancelled: { label: "Annulée", variant: "destructive" },
    }
    const config = statusConfig[status] || { label: status, variant: "secondary" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
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
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmées</SelectItem>
                  <SelectItem value="processing">En préparation</SelectItem>
                  <SelectItem value="shipped">Expédiées</SelectItem>
                  <SelectItem value="delivered">Livrées</SelectItem>
                  <SelectItem value="cancelled">Annulées</SelectItem>
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
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{getPaymentBadge(order.payment_status)}</TableCell>
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
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir les détails
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Changer le statut
                              </DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "confirmed")}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirmer
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
    </div>
  )
}
