"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flag,
  Building2,
  ArrowRight,
  Eye,
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  newUsersToday: number
  totalProducts: number
  pendingProducts: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  openReports: number
  openDisputes: number
  pendingVerifications: number
}

interface RecentOrder {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
  buyer: { full_name: string; avatar_url?: string }
}

interface RecentUser {
  id: string
  full_name: string
  email: string
  user_type: string
  created_at: string
  avatar_url?: string
}

interface PendingProduct {
  id: string
  name: string
  price: number
  seller: { full_name: string }
  created_at: string
  images?: string[]
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    totalProducts: 0,
    pendingProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    openReports: 0,
    openDisputes: 0,
    pendingVerifications: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    const supabase = createClient()
    
    // Fetch counts
    const [
      usersResult,
      productsResult,
      pendingProductsResult,
      ordersResult,
      reportsResult,
      disputesResult,
      verificationsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("moderation_status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("disputes").select("*", { count: "exact", head: true }).in("status", ["open", "under_review"]),
      supabase.from("verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ])

    // Fetch today's new users
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: newUsersToday } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString())

    // Fetch total revenue
    const { data: revenueData } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("payment_status", "paid")
    
    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

    // Fetch pending orders
    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "confirmed"])

    setStats({
      totalUsers: usersResult.count || 0,
      newUsersToday: newUsersToday || 0,
      totalProducts: productsResult.count || 0,
      pendingProducts: pendingProductsResult.count || 0,
      totalOrders: ordersResult.count || 0,
      pendingOrders: pendingOrders || 0,
      totalRevenue,
      openReports: reportsResult.count || 0,
      openDisputes: disputesResult.count || 0,
      pendingVerifications: verificationsResult.count || 0,
    })

    // Fetch recent orders
    const { data: ordersData } = await supabase
      .from("orders")
      .select(`
        id, order_number, total_amount, status, created_at,
        buyer:profiles!orders_buyer_id_fkey(full_name, avatar_url)
      `)
      .order("created_at", { ascending: false })
      .limit(5)

    if (ordersData) {
      setRecentOrders(ordersData.map(order => ({
        ...order,
        buyer: Array.isArray(order.buyer) ? order.buyer[0] : order.buyer
      })) as RecentOrder[])
    }

    // Fetch recent users
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_type, created_at, avatar_url")
      .order("created_at", { ascending: false })
      .limit(5)

    if (usersData) {
      setRecentUsers(usersData as RecentUser[])
    }

    // Fetch pending products
    const { data: productsData } = await supabase
      .from("products")
      .select(`
        id, name, price, images, created_at,
        seller:profiles!products_seller_id_fkey(full_name)
      `)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false })
      .limit(5)

    if (productsData) {
      setPendingProducts(productsData.map(product => ({
        ...product,
        seller: Array.isArray(product.seller) ? product.seller[0] : product.seller
      })) as PendingProduct[])
    }

    setLoading(false)
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
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-8 bg-muted rounded w-16 mt-2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la plateforme GWA</p>
      </div>

      {/* Alerts */}
      {(stats.pendingProducts > 0 || stats.openReports > 0 || stats.openDisputes > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {stats.pendingProducts > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{stats.pendingProducts} produit(s) en attente</p>
                  <p className="text-sm text-muted-foreground">Modération requise</p>
                </div>
                <Link href="/admin/products?status=pending">
                  <Button variant="outline" size="sm" className="bg-transparent">
                    Voir
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {stats.openReports > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{stats.openReports} signalement(s)</p>
                  <p className="text-sm text-muted-foreground">À traiter</p>
                </div>
                <Link href="/admin/reports">
                  <Button variant="outline" size="sm" className="bg-transparent">
                    Voir
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {stats.openDisputes > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{stats.openDisputes} litige(s) ouvert(s)</p>
                  <p className="text-sm text-muted-foreground">Résolution requise</p>
                </div>
                <Link href="/admin/disputes">
                  <Button variant="outline" size="sm" className="bg-transparent">
                    Voir
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              +{stats.newUsersToday} aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingProducts} en attente de modération
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingOrders} en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Total des ventes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Commandes récentes</CardTitle>
              <CardDescription>Les 5 dernières commandes</CardDescription>
            </div>
            <Link href="/admin/orders">
              <Button variant="outline" size="sm" className="bg-transparent">
                Voir tout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune commande</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={order.buyer?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{order.buyer?.full_name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.buyer?.full_name || "Client"} - {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(order.total_amount)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Nouveaux utilisateurs</CardTitle>
              <CardDescription>Les 5 derniers inscrits</CardDescription>
            </div>
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="bg-transparent">
                Voir tout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun utilisateur</p>
            ) : (
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{user.full_name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || "Sans nom"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge variant="outline">{user.user_type || "user"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Products */}
      {pendingProducts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Produits en attente de modération</CardTitle>
              <CardDescription>Produits nécessitant une validation</CardDescription>
            </div>
            <Link href="/admin/products?status=pending">
              <Button variant="outline" size="sm" className="bg-transparent">
                Voir tout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingProducts.map((product) => (
                <div key={product.id} className="flex gap-3 p-3 border rounded-lg">
                  <div className="h-16 w-16 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {product.images?.[0] ? (
                      <img 
                        src={product.images[0] || "/placeholder.svg"} 
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      Par {product.seller?.full_name || "Vendeur"}
                    </p>
                    <p className="text-sm font-medium">{formatCurrency(product.price)}</p>
                  </div>
                  <Link href={`/admin/products/${product.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
