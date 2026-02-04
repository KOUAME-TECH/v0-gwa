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
import { Hammer, Star, Package, DollarSign, Users, TrendingUp, Clock, Award, MessageSquare, ImageIcon, Plus, Loader2 } from 'lucide-react'
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
  buyer_id: string
  order_items: {
    product_id: string
    quantity: number
    products: {
      name: string
    } | null
  }[]
  profiles: {
    full_name: string
  } | null
}

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  profiles: {
    full_name: string
  } | null
}

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  avgRating: number
  totalReviews: number
}

export default function ArtisanDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    avgRating: 0,
    totalReviews: 0
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

      // Recuperer le profil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileData) {
        setProfile(profileData)
      }

      // Recuperer les produits de l'artisan
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', authUser.id)
        .eq('product_type', 'artisanat')
        .order('created_at', { ascending: false })

      if (productsData) {
        setProducts(productsData)
      }

      // Recuperer les commandes liees aux produits de l'artisan
      const productIds = productsData?.map(p => p.id) || []
      
      if (productIds.length > 0) {
        const { data: orderItemsData } = await supabase
          .from('order_items')
          .select(`
            order_id,
            product_id,
            quantity,
            products (name)
          `)
          .in('product_id', productIds)

        if (orderItemsData && orderItemsData.length > 0) {
          const orderIds = [...new Set(orderItemsData.map(oi => oi.order_id))]
          
          const { data: ordersData } = await supabase
            .from('orders')
            .select(`
              *,
              profiles:buyer_id (full_name)
            `)
            .in('id', orderIds)
            .order('created_at', { ascending: false })
            .limit(5)

          if (ordersData) {
            // Attacher les items aux commandes
            const ordersWithItems = ordersData.map(order => ({
              ...order,
              order_items: orderItemsData.filter(oi => oi.order_id === order.id)
            }))
            setOrders(ordersWithItems)
          }
        }
      }

      // Recuperer les avis
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq('seller_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (reviewsData) {
        setReviews(reviewsData)
      }

      // Calculer les statistiques
      const totalRevenue = orders.reduce((sum, o) => 
        o.status === 'delivered' ? sum + (o.total_amount || 0) : sum, 0)
      
      const uniqueCustomers = new Set(orders.map(o => o.buyer_id)).size
      
      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length
        : 0

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        totalCustomers: uniqueCustomers,
        avgRating,
        totalReviews: reviewsData?.length || 0
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
              <h1 className="text-3xl font-bold mb-2">Espace Artisan</h1>
              <p className="text-muted-foreground">Presentez votre savoir-faire et developpez votre activite</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-base px-4 py-2">
                <Star className="mr-2 h-4 w-4 fill-current" />
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"} / 5.0
              </Badge>
            </div>
          </div>

          {/* Stats artisan */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus ce mois</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} FCFA</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalRevenue > 0 ? "Ventes realisees" : "Aucune vente ce mois"}
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
                  {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length} en cours
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clients</CardTitle>
                <Users className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Clients uniques
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avis</CardTitle>
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalReviews}</div>
                <p className="text-xs text-muted-foreground">
                  Note moyenne: {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Commandes en cours */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Commandes en Cours</CardTitle>
                    <CardDescription>Suivez l'avancement de vos projets</CardDescription>
                  </div>
                  <Link href="/dashboard/commandes">
                    <Button size="sm" variant="outline">Voir tout</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune commande</h3>
                    <p className="text-muted-foreground mb-4">
                      Vos commandes apparaitront ici
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
                    {orders.map((order) => (
                      <div key={order.id} className="p-4 rounded-lg border hover:border-primary transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Hammer className="h-4 w-4 text-primary" />
                              <h3 className="font-semibold">
                                {order.order_items?.[0]?.products?.name || "Commande"}
                              </h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Client: {order.profiles?.full_name || "Client"}
                            </p>
                          </div>
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
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-primary">
                            {order.total_amount?.toLocaleString() || 0} FCFA
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Contacter
                            </Button>
                            <Link href={`/dashboard/commandes`}>
                              <Button size="sm">Voir</Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions et portfolio */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>Gerez votre activite</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/dashboard/products/new">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une creation
                    </Button>
                  </Link>
                  <Link href="/dashboard/products">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Package className="mr-2 h-4 w-4" />
                      Mes creations
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Gerer le portfolio
                  </Button>
                  <Link href="/network">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Users className="mr-2 h-4 w-4" />
                      Trouver des clients
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Produits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Mes Creations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {products.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm mb-3">
                        Aucune creation pour le moment
                      </p>
                      <Link href="/dashboard/products/new">
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    products.slice(0, 3).map((product) => (
                      <div key={product.id} className="p-3 rounded-lg border flex items-center gap-3">
                        {product.images?.[0] ? (
                          <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={product.images[0] || "/placeholder.svg"}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Hammer className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.price.toLocaleString()} FCFA
                          </p>
                        </div>
                        <Badge variant={product.status === 'active' ? "default" : "secondary"}>
                          {product.status === 'active' ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    ))
                  )}
                  {products.length > 3 && (
                    <Link href="/dashboard/products">
                      <Button variant="ghost" className="w-full" size="sm">
                        Voir tous ({products.length})
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Certifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Mes Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile?.is_verified ? (
                    <div className="p-3 rounded-lg border flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Award className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Artisan Certifie GWA</p>
                        <p className="text-xs text-muted-foreground">Verifie</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm mb-3">
                        Obtenez la certification GWA
                      </p>
                      <Button size="sm" variant="outline">
                        Demander
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Avis recents */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Avis Recents</CardTitle>
                  <CardDescription>Ce que disent vos clients</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun avis</h3>
                  <p className="text-muted-foreground">
                    Les avis de vos clients apparaitront ici
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 rounded-lg border hover:border-primary transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          {review.profiles?.full_name || "Client"}
                        </span>
                        <div className="flex gap-1">
                          {[...Array(review.rating)].map((_, j) => (
                            <Star key={j} className="h-4 w-4 text-yellow-500 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {review.comment || "Pas de commentaire"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString('fr-FR')}
                      </p>
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
