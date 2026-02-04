"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ShoppingCart, Package, TrendingUp, DollarSign, Heart, 
  Clock, Star, MapPin, ArrowRight, Search, Filter,
  Truck, CheckCircle2, Loader2
} from 'lucide-react'
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  order_items: {
    product_id: string
    quantity: number
    products: {
      name: string
      images: string[]
      profiles: {
        full_name: string
      } | null
    } | null
  }[]
}

interface Favorite {
  id: string
  product: {
    id: string
    name: string
    price: number
    unit: string
    images: string[]
    profiles: {
      full_name: string
    } | null
  }
}

interface DashboardStats {
  totalSpent: number
  totalOrders: number
  totalFavorites: number
  totalSuppliers: number
}

export default function BuyerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalSpent: 0,
    totalOrders: 0,
    totalFavorites: 0,
    totalSuppliers: 0
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

      // Recuperer les commandes de l'acheteur
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          order_items (
            product_id,
            quantity,
            products (
              name,
              images,
              profiles:seller_id (full_name)
            )
          )
        `)
        .eq('buyer_id', authUser.id)
        .order('created_at', { ascending: false })

      if (ordersData) {
        setOrders(ordersData)
      }

      // Recuperer les favoris
      const { data: favoritesData } = await supabase
        .from('favorites')
        .select(`
          id,
          product:product_id (
            id,
            name,
            price,
            unit,
            images,
            profiles:seller_id (full_name)
          )
        `)
        .eq('user_id', authUser.id)
        .limit(5)

      if (favoritesData) {
        setFavorites(favoritesData as any)
      }

      // Recuperer des produits recommandes (les plus recents)
      const { data: recoData } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          unit,
          images,
          profiles:seller_id (
            full_name,
            city,
            country
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3)

      if (recoData) {
        setRecommendations(recoData)
      }

      // Calculer les statistiques
      const totalSpent = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const uniqueSuppliers = new Set(
        ordersData?.flatMap(o => 
          o.order_items?.map(oi => oi.products?.profiles?.full_name).filter(Boolean)
        )
      ).size

      setStats({
        totalSpent,
        totalOrders: ordersData?.length || 0,
        totalFavorites: favoritesData?.length || 0,
        totalSuppliers: uniqueSuppliers
      })

      setIsLoading(false)
    }

    fetchDashboardData()
  }, [router])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Livree</Badge>
      case "shipping":
        return <Badge className="bg-orange-500"><Truck className="h-3 w-3 mr-1" />En livraison</Badge>
      case "confirmed":
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Confirmee</Badge>
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <h1 className="text-3xl font-bold mb-2">Espace Acheteur</h1>
              <p className="text-muted-foreground">Gerez vos achats et decouvrez de nouveaux produits</p>
            </div>
            <Link href="/agriculture">
              <Button>
                <Search className="mr-2 h-4 w-4" />
                Explorer les produits
              </Button>
            </Link>
          </div>

          {/* Stats acheteur */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total depense</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSpent.toLocaleString()} FCFA</div>
                <p className="text-xs text-muted-foreground">
                  Total des achats
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <Package className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {orders.filter(o => o.status === 'shipping' || o.status === 'confirmed').length} en cours
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Favoris</CardTitle>
                <Heart className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFavorites}</div>
                <p className="text-xs text-muted-foreground">
                  Produits sauvegardes
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
                <p className="text-xs text-muted-foreground">
                  Fournisseurs differents
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Search */}
          <Card className="mb-8">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher des produits agricoles ou artisanaux..." className="pl-10" />
                </div>
                <Button variant="outline" className="bg-transparent">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                </Button>
                <Link href="/agriculture">
                  <Button>Rechercher</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Commandes recentes */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mes Commandes Recentes</CardTitle>
                    <CardDescription>Suivez vos achats en cours</CardDescription>
                  </div>
                  <Link href="/dashboard/commandes">
                    <Button variant="outline" size="sm" className="bg-transparent">Voir tout</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune commande</h3>
                    <p className="text-muted-foreground mb-4">
                      Commencez vos achats sur GWA
                    </p>
                    <Link href="/agriculture">
                      <Button>Explorer les produits</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="p-4 rounded-lg border hover:border-primary transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">#{order.id.slice(0, 8)}</span>
                              {getStatusBadge(order.status)}
                            </div>
                            <p className="text-sm font-medium">
                              {order.order_items?.[0]?.products?.name || "Produit"}
                              {order.order_items && order.order_items.length > 1 && 
                                ` + ${order.order_items.length - 1} autre(s)`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.order_items?.[0]?.products?.profiles?.full_name || "Vendeur"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {order.total_amount?.toLocaleString() || 0} FCFA
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href="/dashboard/commandes" className="flex-1">
                            <Button size="sm" variant="outline" className="w-full bg-transparent">
                              Voir details
                            </Button>
                          </Link>
                          {order.status === "shipping" && (
                            <Button size="sm" className="flex-1">
                              <Truck className="h-4 w-4 mr-1" />
                              Suivre
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Colonne droite */}
            <div className="space-y-6">
              {/* Produits favoris */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Mes Favoris
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {favorites.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm mb-3">
                        Aucun favori pour le moment
                      </p>
                      <Link href="/agriculture">
                        <Button size="sm" variant="outline">
                          Explorer
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    favorites.map((fav) => (
                      <div key={fav.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                        {fav.product?.images?.[0] ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <Image 
                              src={fav.product.images[0] || "/placeholder.svg"} 
                              alt={fav.product.name}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{fav.product?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {fav.product?.profiles?.full_name}
                          </p>
                          <span className="text-sm font-medium text-primary">
                            {fav.product?.price?.toLocaleString()} FCFA/{fav.product?.unit}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {favorites.length > 0 && (
                    <Link href="/agriculture">
                      <Button variant="ghost" className="w-full">
                        Voir tous les favoris
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Recommandations */}
              <Card>
                <CardHeader>
                  <CardTitle>Nouveaux produits</CardTitle>
                  <CardDescription>Decouvrez les dernieres arrivees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Aucun produit disponible
                    </p>
                  ) : (
                    recommendations.map((product) => (
                      <Link key={product.id} href={`/agriculture/produit/${product.id}`}>
                        <div className="p-3 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.profiles?.full_name}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-medium text-primary">
                              {product.price?.toLocaleString()} FCFA/{product.unit}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {product.profiles?.city || "Afrique"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Actions rapides */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/agriculture">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Search className="mr-2 h-4 w-4" />
                      Produits agricoles
                    </Button>
                  </Link>
                  <Link href="/artisans">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Package className="mr-2 h-4 w-4" />
                      Artisanat
                    </Button>
                  </Link>
                  <Link href="/artisans/commissions">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Star className="mr-2 h-4 w-4" />
                      Commande sur-mesure
                    </Button>
                  </Link>
                  <Link href="/panier">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Mon panier
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
