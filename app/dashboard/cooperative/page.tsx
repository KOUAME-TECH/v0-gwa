"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Users, TrendingUp, Package, DollarSign, MapPin, 
  UserPlus, FileText, BarChart3, Settings,
  ArrowUp, AlertCircle, CheckCircle2, Loader2, Plus
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

interface Member {
  id: string
  full_name: string
  user_type: string
  city: string
  country: string
  is_verified: boolean
  created_at: string
  products_count?: number
}

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
    } | null
  }[]
  profiles: {
    full_name: string
  } | null
}

interface DashboardStats {
  totalRevenue: number
  totalMembers: number
  totalProducts: number
  pendingOrders: number
}

export default function CooperativeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalMembers: 0,
    totalProducts: 0,
    pendingOrders: 0
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

      // Recuperer les membres de la cooperative (tous les farmers/artisans de la meme region)
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .in('user_type', ['farmer', 'artisan'])
        .eq('country', profileData?.country || '')
        .order('created_at', { ascending: false })
        .limit(10)

      if (membersData) {
        // Compter les produits pour chaque membre
        const membersWithProducts = await Promise.all(
          membersData.map(async (member) => {
            const { count } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('seller_id', member.id)
              .eq('status', 'active')
            
            return {
              ...member,
              products_count: count || 0
            }
          })
        )
        setMembers(membersWithProducts)
      }

      // Recuperer les commandes recentes de la region
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_id,
            quantity,
            products (name)
          ),
          profiles:buyer_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (ordersData) {
        setOrders(ordersData)
      }

      // Compter les produits totaux des membres
      const memberIds = membersData?.map(m => m.id) || []
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .in('seller_id', memberIds)
        .eq('status', 'active')

      // Calculer les statistiques
      const totalRevenue = ordersData?.reduce((sum, o) => 
        o.status === 'delivered' ? sum + (o.total_amount || 0) : sum, 0) || 0
      
      const pendingOrders = ordersData?.filter(o => 
        o.status === 'pending' || o.status === 'confirmed' || o.status === 'shipping'
      ).length || 0

      setStats({
        totalRevenue,
        totalMembers: membersData?.length || 0,
        totalProducts: productsCount || 0,
        pendingOrders
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
              <h1 className="text-3xl font-bold mb-2">Espace Cooperative</h1>
              <p className="text-muted-foreground">Gerez vos membres et centralisez les ventes</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-base px-4 py-2">
                <Users className="mr-2 h-4 w-4" />
                {stats.totalMembers} membres
              </Badge>
            </div>
          </div>

          {/* Stats cooperative */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} FCFA</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {stats.totalRevenue > 0 ? (
                    <span className="text-green-500 flex items-center">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Ventes realisees
                    </span>
                  ) : (
                    "Aucune vente pour le moment"
                  )}
                </div>
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
                  Produits des membres
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Membres actifs</CardTitle>
                <Users className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground">
                  {members.filter(m => m.is_verified).length} verifies
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes en cours</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  A traiter
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Membres et production */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Membres de la Cooperative</CardTitle>
                    <CardDescription>Producteurs et artisans de votre region</CardDescription>
                  </div>
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Inviter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun membre</h3>
                    <p className="text-muted-foreground mb-4">
                      Invitez des producteurs et artisans a rejoindre la cooperative
                    </p>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Inviter des membres
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div key={member.id} className="p-4 rounded-lg border hover:border-primary transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-bold text-primary">
                                {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || "?"}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{member.full_name || "Membre"}</h3>
                              <p className="text-sm text-muted-foreground">
                                {member.user_type === 'farmer' ? 'Producteur' : 'Artisan'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={member.is_verified ? "default" : "secondary"}>
                            {member.is_verified ? "Verifie" : "Non verifie"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Localisation</p>
                            <p className="font-medium flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {member.city || member.country?.toUpperCase() || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Produits</p>
                            <p className="font-medium">{member.products_count || 0}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" className="bg-transparent">Voir profil</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions et stats */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Inviter un membre
                  </Button>
                  <Link href="/dashboard/products/new">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Package className="mr-2 h-4 w-4" />
                      Ajouter un produit
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <FileText className="mr-2 h-4 w-4" />
                    Generer un rapport
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Voir les statistiques
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Settings className="mr-2 h-4 w-4" />
                    Parametres
                  </Button>
                </CardContent>
              </Card>

              {/* Repartition des types de membres */}
              <Card>
                <CardHeader>
                  <CardTitle>Repartition des Membres</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const farmers = members.filter(m => m.user_type === 'farmer').length
                    const artisans = members.filter(m => m.user_type === 'artisan').length
                    const total = members.length || 1
                    
                    return [
                      { 
                        type: "Producteurs", 
                        count: farmers, 
                        percentage: Math.round((farmers / total) * 100), 
                        color: "bg-primary" 
                      },
                      { 
                        type: "Artisans", 
                        count: artisans, 
                        percentage: Math.round((artisans / total) * 100), 
                        color: "bg-secondary" 
                      },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.type}</span>
                          <span className="text-muted-foreground">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div 
                            className={`h-full ${item.color}`} 
                            style={{ width: `${item.percentage}%` }} 
                          />
                        </div>
                      </div>
                    ))
                  })()}
                </CardContent>
              </Card>

              {/* Alertes */}
              <Card className="border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Alertes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.pendingOrders > 0 && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm font-medium">Commandes en attente</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.pendingOrders} commande(s) a traiter
                      </p>
                    </div>
                  )}
                  {members.filter(m => !m.is_verified).length > 0 && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm font-medium">Membres non verifies</p>
                      <p className="text-xs text-muted-foreground">
                        {members.filter(m => !m.is_verified).length} membre(s) en attente
                      </p>
                    </div>
                  )}
                  {members.length === 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium">Commencez maintenant</p>
                      <p className="text-xs text-muted-foreground">
                        Invitez des membres pour developper la cooperative
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Commandes recentes */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Commandes Recentes</CardTitle>
                  <CardDescription>Transactions de la cooperative</CardDescription>
                </div>
                <Link href="/dashboard/commandes">
                  <Button variant="outline" size="sm" className="bg-transparent">Voir tout</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune commande</h3>
                  <p className="text-muted-foreground">
                    Les commandes des membres apparaitront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold">#{order.id.slice(0, 8)}</span>
                          <Badge variant={
                            order.status === 'delivered' ? "default" : 
                            order.status === 'shipping' ? "secondary" : "outline"
                          }>
                            {order.status === "delivered" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {order.status === 'delivered' ? 'Livre' :
                             order.status === 'shipping' ? 'En livraison' :
                             order.status === 'confirmed' ? 'Confirme' :
                             order.status === 'pending' ? 'En attente' : order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.profiles?.full_name || "Client"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.order_items?.[0]?.products?.name || "Produit"} 
                          {order.order_items && order.order_items.length > 1 && 
                            ` + ${order.order_items.length - 1} autre(s)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary text-lg">
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
