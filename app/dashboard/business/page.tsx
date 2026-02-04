"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, TrendingUp, Users, ShoppingBag, DollarSign, Package, BarChart3, Loader2 } from 'lucide-react'
import Link from "next/link"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Stats {
  revenue: number
  orders: number
  products: number
  suppliers: number
}

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  products?: { name: string }
  profiles?: { full_name: string }
}

export default function BusinessDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<Stats>({ revenue: 0, orders: 0, products: 0, suppliers: 0 })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  
  const supabase = createClient()

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login?redirect=/dashboard/business')
      return
    }
    
    setUser(user)

    // Get orders where user is buyer (entreprise)
    const { data: ordersData, count: ordersCount } = await supabase
      .from('orders')
      .select('*, products:order_items(product_id), profiles:seller_id(full_name)', { count: 'exact' })
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    const orders = ordersData || []
    const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    // Count unique suppliers
    const supplierIds = new Set(orders.map(o => o.seller_id).filter(Boolean))

    // Get recent orders
    const { data: recentOrdersData } = await supabase
      .from('orders')
      .select(`
        *,
        profiles:seller_id(full_name)
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    setRecentOrders(recentOrdersData || [])

    // Calculate monthly revenue data
    const monthlyData: Record<string, number> = {}
    const months = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec']
    
    orders.forEach(order => {
      const date = new Date(order.created_at)
      const monthKey = months[date.getMonth()]
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (order.total_amount || 0)
    })

    // Get last 6 months
    const currentMonth = new Date().getMonth()
    const chartData = []
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12
      const month = months[monthIndex]
      chartData.push({
        month,
        revenus: monthlyData[month] || 0
      })
    }

    setRevenueData(chartData)

    setStats({
      revenue,
      orders: ordersCount || 0,
      products: 0, // Enterprises typically buy, not sell
      suppliers: supplierIds.size
    })

    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'En attente',
      confirmed: 'Confirmee',
      shipped: 'Expediee',
      delivered: 'Livree',
      cancelled: 'Annulee'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
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
              <h1 className="text-3xl font-bold mb-2">Tableau de Bord Entreprise</h1>
              <p className="text-muted-foreground">Vue d'ensemble de votre activite commerciale</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/rfq">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Demandes de devis
                </Link>
              </Button>
              <Button asChild>
                <Link href="/marketplace">
                  <Package className="mr-2 h-4 w-4" />
                  Explorer le marche
                </Link>
              </Button>
            </div>
          </div>

          {/* KPIs principaux */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Achats</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.revenue.toLocaleString()} FCFA</div>
                <p className="text-xs text-muted-foreground">Valeur totale des commandes</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                <ShoppingBag className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.orders}</div>
                <p className="text-xs text-muted-foreground">Nombre total de commandes</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.suppliers}</div>
                <p className="text-xs text-muted-foreground">Partenaires actifs</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Panier moyen</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.orders > 0 ? Math.round(stats.revenue / stats.orders).toLocaleString() : 0} FCFA
                </div>
                <p className="text-xs text-muted-foreground">Par commande</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Graphique revenus */}
            <Card>
              <CardHeader>
                <CardTitle>Evolution des achats</CardTitle>
                <CardDescription>Vos depenses sur les 6 derniers mois</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toLocaleString()} FCFA`, 'Montant']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="revenus" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Commandes recentes */}
            <Card>
              <CardHeader>
                <CardTitle>Commandes recentes</CardTitle>
                <CardDescription>Vos dernieres commandes</CardDescription>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune commande pour le moment</p>
                    <Button className="mt-4" asChild>
                      <Link href="/marketplace">Explorer le marche</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">Commande #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.profiles?.full_name || 'Vendeur'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{order.total_amount?.toLocaleString()} FCFA</p>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    <Button variant="outline" className="w-full bg-transparent" asChild>
                      <Link href="/dashboard/commandes">Voir toutes les commandes</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
