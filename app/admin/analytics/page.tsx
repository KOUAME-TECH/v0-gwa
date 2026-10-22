"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, Package, ShoppingCart, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Calendar, RefreshCw, Download,
  MapPin, Building2, Leaf, Palette, DollarSign, BarChart3
} from "lucide-react"

interface AnalyticsData {
  // Users
  totalUsers: number
  usersByType: { type: string; count: number }[]
  usersByCountry: { country: string; count: number }[]
  newUsersThisMonth: number
  newUsersLastMonth: number
  
  // Products
  totalProducts: number
  productsByType: { type: string; count: number }[]
  productsByCategory: { category: string; count: number }[]
  
  // Orders
  totalOrders: number
  ordersByStatus: { status: string; count: number }[]
  totalRevenue: number
  revenueThisMonth: number
  revenueLastMonth: number
  averageOrderValue: number
  
  // Cooperatives
  totalCooperatives: number
  verifiedCooperatives: number
  
  // RFQs
  totalRfqs: number
  openRfqs: number
  // Escrow / litiges
  escrowHeld: number
  openDisputes: number
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("month")
  
  const supabase = createClient()

  useEffect(() => {
    loadAnalytics()
  }, [period])

  async function loadAnalytics() {
    setLoading(true)
    
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const periodStart =
      period === "week"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : period === "year"
          ? new Date(now.getFullYear(), 0, 1)
          : thisMonthStart

    // Users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { data: usersByTypeData } = await supabase
      .from('profiles')
      .select('user_type')
    
    const usersByType = Object.entries(
      (usersByTypeData || []).reduce((acc: Record<string, number>, u) => {
        acc[u.user_type || 'other'] = (acc[u.user_type || 'other'] || 0) + 1
        return acc
      }, {})
    ).map(([type, count]) => ({ type, count }))

    const { data: usersByCountryData } = await supabase
      .from('profiles')
      .select('country')
    
    const usersByCountry = Object.entries(
      (usersByCountryData || []).reduce((acc: Record<string, number>, u) => {
        acc[u.country || 'Unknown'] = (acc[u.country || 'Unknown'] || 0) + 1
        return acc
      }, {})
    ).map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const { count: newUsersThisMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonthStart.toISOString())

    const { count: newUsersLastMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastMonthStart.toISOString())
      .lt('created_at', lastMonthEnd.toISOString())

    // Products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { data: productsByTypeData } = await supabase
      .from('products')
      .select('product_type')
      .eq('status', 'active')
    
    const productsByType = Object.entries(
      (productsByTypeData || []).reduce((acc: Record<string, number>, p) => {
        acc[p.product_type || 'other'] = (acc[p.product_type || 'other'] || 0) + 1
        return acc
      }, {})
    ).map(([type, count]) => ({ type, count }))

    const { data: productsByCategoryData } = await supabase
      .from('products')
      .select('category_id, categories(name)')
      .eq('status', 'active')
    
    const productsByCategory = Object.entries(
      (productsByCategoryData || []).reduce((acc: Record<string, number>, p: any) => {
        const catName = p.categories?.name || 'Other'
        acc[catName] = (acc[catName] || 0) + 1
        return acc
      }, {})
    ).map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Orders (filtrées par période sélectionnée pour volume / CA période)
    let ordersQuery = supabase.from('orders').select('*', { count: 'exact', head: true })
    if (period !== "all") {
      ordersQuery = ordersQuery.gte('created_at', periodStart.toISOString())
    }
    const { count: totalOrders } = await ordersQuery

    let ordersStatusQuery = supabase.from('orders').select('status')
    if (period !== "all") {
      ordersStatusQuery = ordersStatusQuery.gte('created_at', periodStart.toISOString())
    }
    const { data: ordersByStatusData } = await ordersStatusQuery
    
    const ordersByStatus = Object.entries(
      (ordersByStatusData || []).reduce((acc: Record<string, number>, o) => {
        acc[o.status || 'unknown'] = (acc[o.status || 'unknown'] || 0) + 1
        return acc
      }, {})
    ).map(([status, count]) => ({ status, count }))

    let revenueQuery = supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
    if (period !== "all") {
      revenueQuery = revenueQuery.gte('created_at', periodStart.toISOString())
    }
    const { data: revenueData } = await revenueQuery
    
    const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
    const averageOrderValue = totalOrders ? totalRevenue / (totalOrders || 1) : 0

    const { data: revenueThisMonthData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', thisMonthStart.toISOString())
    
    const revenueThisMonth = revenueThisMonthData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

    const { data: revenueLastMonthData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', lastMonthStart.toISOString())
      .lt('created_at', lastMonthEnd.toISOString())
    
    const revenueLastMonth = revenueLastMonthData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0

    const { count: escrowHeld } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("escrow_status", "held")

    const { count: openDisputes } = await supabase
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "under_review"])

    // Cooperatives
    const { count: totalCooperatives } = await supabase
      .from('cooperatives')
      .select('*', { count: 'exact', head: true })

    const { count: verifiedCooperatives } = await supabase
      .from('cooperatives')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true)

    // RFQs
    const { count: totalRfqs } = await supabase
      .from('rfq_requests')
      .select('*', { count: 'exact', head: true })

    const { count: openRfqs } = await supabase
      .from('rfq_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')

    setData({
      totalUsers: totalUsers || 0,
      usersByType,
      usersByCountry,
      newUsersThisMonth: newUsersThisMonth || 0,
      newUsersLastMonth: newUsersLastMonth || 0,
      totalProducts: totalProducts || 0,
      productsByType,
      productsByCategory,
      totalOrders: totalOrders || 0,
      ordersByStatus,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      averageOrderValue,
      totalCooperatives: totalCooperatives || 0,
      verifiedCooperatives: verifiedCooperatives || 0,
      totalRfqs: totalRfqs || 0,
      openRfqs: openRfqs || 0,
      escrowHeld: escrowHeld || 0,
      openDisputes: openDisputes || 0,
    })

    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getGrowthPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous * 100).toFixed(1)
  }

  const getUserTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'producteur': 'Producteurs',
      'acheteur': 'Acheteurs',
      'cooperative': 'Coopératives',
      'entreprise': 'Entreprises',
      'other': 'Autres'
    }
    return labels[type] || type
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmées",
      processing: "En préparation",
      preparing: "En préparation",
      shipped: "En livraison",
      shipping: "En livraison",
      delivered: "Livrées",
      cancelled: "Annulées",
      disputed: "Litiges",
    }
    return labels[status] || status
  }

  const getCountryName = (code: string) => {
    const countries: Record<string, string> = {
      'CI': "Côte d'Ivoire",
      'GH': 'Ghana',
      'SN': 'Sénégal',
      'BF': 'Burkina Faso',
      'ML': 'Mali',
      'BJ': 'Bénin',
      'TG': 'Togo',
      'NE': 'Niger',
      'NG': 'Nigeria',
      'CM': 'Cameroun'
    }
    return countries[code] || code
  }

  const handleExport = (type: string) => {
    if (!data) return
    
    let csvContent = ""
    let filename = ""
    
    switch (type) {
      case 'users':
        csvContent = "Type,Nombre\n" + data.usersByType.map(u => `${getUserTypeLabel(u.type)},${u.count}`).join("\n")
        filename = "utilisateurs_par_type.csv"
        break
      case 'products':
        csvContent = "Type,Nombre\n" + data.productsByType.map(p => `${p.type},${p.count}`).join("\n")
        filename = "produits_par_type.csv"
        break
      case 'orders':
        csvContent = "Statut,Nombre\n" + data.ordersByStatus.map(o => `${getStatusLabel(o.status)},${o.count}`).join("\n")
        filename = "commandes_par_statut.csv"
        break
      case 'countries':
        csvContent = "Pays,Utilisateurs\n" + data.usersByCountry.map(c => `${getCountryName(c.country)},${c.count}`).join("\n")
        filename = "utilisateurs_par_pays.csv"
        break
      default:
        return
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const userGrowth = getGrowthPercent(data.newUsersThisMonth, data.newUsersLastMonth)
  const revenueGrowth = getGrowthPercent(data.revenueThisMonth, data.revenueLastMonth)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Statistiques détaillées de la plateforme</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 jours</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers.toLocaleString()}</div>
            <div className="flex items-center text-xs mt-1">
              {Number(userGrowth) >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={Number(userGrowth) >= 0 ? "text-green-500" : "text-red-500"}>
                {userGrowth}%
              </span>
              <span className="text-muted-foreground ml-1">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produits actifs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts.toLocaleString()}</div>
            <div className="flex gap-2 mt-1">
              {data.productsByType.slice(0, 2).map(p => (
                <Badge key={p.type} variant="outline" className="text-xs">
                  {p.type}: {p.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Panier moyen: {formatCurrency(data.averageOrderValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <div className="flex items-center text-xs mt-1">
              {Number(revenueGrowth) >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={Number(revenueGrowth) >= 0 ? "text-green-500" : "text-red-500"}>
                {revenueGrowth}%
              </span>
              <span className="text-muted-foreground ml-1">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Escrow held</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.escrowHeld.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Commandes fonds en séquestre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Litiges ouverts</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.openDisputes.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">À traiter dans /admin/disputes</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExport('users')}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Utilisateurs par type</CardTitle>
                <CardDescription>Répartition des utilisateurs par catégorie</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.usersByType.map(item => (
                    <div key={item.type} className="flex items-center gap-3">
                      <div className="w-32 text-sm font-medium">{getUserTypeLabel(item.type)}</div>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(item.count / data.totalUsers * 100)}%` }}
                        />
                      </div>
                      <div className="w-16 text-sm text-right">{item.count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Utilisateurs par pays</CardTitle>
                  <CardDescription>Top 10 des pays</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleExport('countries')}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.usersByCountry.map((item, index) => (
                    <div key={item.country} className="flex items-center gap-3">
                      <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{getCountryName(item.country)}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExport('products')}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Produits par type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.productsByType.map(item => (
                    <div key={item.type} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        {item.type === 'agriculture' ? (
                          <Leaf className="h-5 w-5 text-green-600" />
                        ) : (
                          <Palette className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium capitalize">{item.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {((item.count / data.totalProducts) * 100).toFixed(1)}% du total
                        </p>
                      </div>
                      <p className="text-2xl font-bold">{item.count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top catégories</CardTitle>
                <CardDescription>Catégories les plus populaires</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.productsByCategory.slice(0, 8).map((item, index) => (
                    <div key={item.category} className="flex items-center gap-3">
                      <span className="w-6 text-sm text-muted-foreground font-medium">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-sm">{item.category}</span>
                      <Badge>{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExport('orders')}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Commandes par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.ordersByStatus.map(item => (
                    <div key={item.status} className="flex items-center gap-3">
                      <div className="w-28 text-sm font-medium">{getStatusLabel(item.status)}</div>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            item.status === 'delivered' ? 'bg-green-500' :
                            item.status === 'cancelled' ? 'bg-red-500' :
                            item.status === 'shipping' ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${(item.count / data.totalOrders * 100)}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm text-right">{item.count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Ce mois</p>
                    <p className="text-xl font-bold">{formatCurrency(data.revenueThisMonth)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Mois dernier</p>
                    <p className="text-xl font-bold">{formatCurrency(data.revenueLastMonth)}</p>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Panier moyen</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.averageOrderValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cooperatives</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.totalCooperatives}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-green-100 text-green-700">
                    {data.verifiedCooperatives} vérifiées
                  </Badge>
                  <Badge variant="outline">
                    {data.totalCooperatives - data.verifiedCooperatives} en attente
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Demandes de devis (RFQ)</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.totalRfqs}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-blue-100 text-blue-700">
                    {data.openRfqs} ouvertes
                  </Badge>
                  <Badge variant="outline">
                    {data.totalRfqs - data.openRfqs} traitees
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Volume B2B</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  Non disponible
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Aucun calcul fondé sur les transactions B2B n’est disponible
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
