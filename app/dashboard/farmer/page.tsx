"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Sprout, CloudRain, TrendingUp, Package, Users, DollarSign, AlertCircle, Calendar, Truck, ShoppingCart, Plus } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

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
  created_at: string
  profiles: {
    full_name: string
  } | null
}

interface DashboardStats {
  totalRevenue: number
  totalProducts: number
  totalOrders: number
  totalCustomers: number
  revenueChange: number
}

export default function FarmerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    revenueChange: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const supabase = createClient()
      
      // Verifier l'authentification
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push("/auth/login")
        return
      }
      setUser(authUser)

      // Recuperer les produits de l'utilisateur
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', authUser.id)
        .order('created_at', { ascending: false })

      if (productsData) {
        setProducts(productsData)
      }

      // Recuperer les commandes (en tant que vendeur)
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:buyer_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (ordersData) {
        setOrders(ordersData)
      }

      // Calculer les statistiques
      const totalRevenue = ordersData?.reduce((sum, o) => 
        o.status === 'delivered' ? sum + (o.total_amount || 0) : sum, 0) || 0
      
      const uniqueCustomers = new Set(ordersData?.map(o => o.buyer_id)).size

      setStats({
        totalRevenue,
        totalProducts: productsData?.length || 0,
        totalOrders: ordersData?.length || 0,
        totalCustomers: uniqueCustomers,
        revenueChange: 18 // Placeholder
      })

      setIsLoading(false)
    }

    fetchDashboardData()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30">
        <div className="container py-8 px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Espace Agriculteur</h1>
              <p className="text-muted-foreground">Gerez votre exploitation et vendez vos produits</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-base px-4 py-2">
                <CloudRain className="mr-2 h-4 w-4" />
                25C - Ensoleille
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus totaux</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} FCFA</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalRevenue > 0 ? (
                    <span className="text-green-500">+{stats.revenueChange}%</span>
                  ) : (
                    "Aucune vente pour le moment"
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produits en vente</CardTitle>
                <Package className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  {products.filter(p => p.status === 'active').length} actifs
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingCart className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {orders.filter(o => o.status === 'shipping').length} en cours de livraison
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Clients uniques
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Products */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mes Produits</CardTitle>
                    <CardDescription>Gerez votre inventaire et vos prix</CardDescription>
                  </div>
                  <Link href="/dashboard/products/new">
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un produit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun produit</h3>
                    <p className="text-muted-foreground mb-4">
                      Commencez a vendre en ajoutant votre premier produit
                    </p>
                    <Link href="/dashboard/products/new">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un produit
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.slice(0, 4).map((product) => (
                      <div key={product.id} className="p-4 rounded-lg border hover:border-primary transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {product.images?.[0] ? (
                              <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted">
                                <Image
                                  src={product.images[0] || "/placeholder.svg"}
                                  alt={product.name}
                                  width={48}
                                  height={48}
                                  className="object-cover w-full h-full"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                                <Sprout className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold">{product.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Stock: {product.stock_quantity} {product.unit}
                              </p>
                            </div>
                          </div>
                          <Badge variant={product.status === 'active' ? "default" : "secondary"}>
                            {product.status === 'active' ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-primary">
                            {product.price.toLocaleString()} FCFA/{product.unit}
                          </span>
                          <Link href={`/dashboard/products/${product.id}/edit`}>
                            <Button size="sm" variant="outline">Modifier</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    {products.length > 4 && (
                      <Link href="/dashboard/products">
                        <Button variant="outline" className="w-full bg-transparent">
                          Voir tous les produits ({products.length})
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions & Alerts */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>Gerez votre activite</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/dashboard/products/new">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Package className="mr-2 h-4 w-4" />
                      Ajouter un produit
                    </Button>
                  </Link>
                  <Link href="/dashboard/commandes">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Truck className="mr-2 h-4 w-4" />
                      Gerer les commandes
                    </Button>
                  </Link>
                  <Link href="/dashboard/stats">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Voir les statistiques
                    </Button>
                  </Link>
                  <Link href="/network">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Users className="mr-2 h-4 w-4" />
                      Trouver des acheteurs
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card className="border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Alertes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {products.filter(p => p.stock_quantity < 100).length > 0 && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm font-medium mb-1">Stock faible</p>
                      <p className="text-xs text-muted-foreground">
                        {products.filter(p => p.stock_quantity < 100).length} produit(s) necessitent un reapprovisionnement
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm font-medium mb-1">Conseil</p>
                    <p className="text-xs text-muted-foreground">
                      Ajoutez des photos de qualite pour augmenter vos ventes
                    </p>
                  </div>
                  {products.length === 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium mb-1">Commencez maintenant</p>
                      <p className="text-xs text-muted-foreground">
                        Ajoutez votre premier produit pour commencer a vendre
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Orders */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Commandes Recentes</CardTitle>
                  <CardDescription>Suivez vos ventes et livraisons</CardDescription>
                </div>
                <Link href="/dashboard/commandes">
                  <Button variant="outline" size="sm">Voir tout</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune commande</h3>
                  <p className="text-muted-foreground">
                    Vos commandes apparaitront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border hover:border-primary transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold">#{order.id.slice(0, 8)}</span>
                          <Badge variant={
                            order.status === 'delivered' ? "default" :
                            order.status === 'shipping' ? "secondary" : "outline"
                          }>
                            {order.status === 'delivered' ? 'Livre' :
                             order.status === 'shipping' ? 'En livraison' :
                             order.status === 'confirmed' ? 'Confirme' :
                             order.status === 'pending' ? 'En attente' : order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.profiles?.full_name || 'Client'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {order.total_amount?.toLocaleString() || 0} FCFA
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
