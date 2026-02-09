"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Building2, TrendingUp, ShoppingBag, Wallet, Users, Bell, ArrowLeft,
  ChevronRight, FileText, BarChart3, Search, Package, Truck,
  CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, Filter, Globe
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { DashboardNav } from "@/components/dashboard-nav"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  profiles: { full_name: string } | null
}

export default function BusinessDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalOrders: 0,
    suppliers: 0,
    avgOrder: 0,
    trend: 0
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push("/auth/login")
        return
      }
      setUser(authUser)

      // Profil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setProfile(profileData)

      // Commandes (en tant qu'acheteur)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, profiles:seller_id(full_name)')
        .eq('buyer_id', authUser.id)
        .order('created_at', { ascending: false })
      setOrders(ordersData || [])

      // Stats
      const totalSpent = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const suppliers = new Set(ordersData?.map(o => o.seller_id).filter(Boolean)).size
      const avgOrder = ordersData && ordersData.length > 0 ? totalSpent / ordersData.length : 0

      // Données graphique (6 derniers mois)
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
      const monthlyData: Record<string, number> = {}
      
      ordersData?.forEach(order => {
        const date = new Date(order.created_at)
        const monthKey = months[date.getMonth()]
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (order.total_amount || 0)
      })

      const currentMonth = new Date().getMonth()
      const chartDataArr = []
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12
        const month = months[monthIndex]
        chartDataArr.push({ month, montant: monthlyData[month] || 0 })
      }
      setChartData(chartDataArr)

      setStats({
        totalSpent,
        totalOrders: ordersData?.length || 0,
        suppliers,
        avgOrder,
        trend: 12 // Placeholder
      })

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-20">
      {/* Header Entreprise - Design corporate sombre */}
      <header className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Espace Entreprise</h1>
          <Link href="/notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        {/* Info entreprise */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-[#6366F1]/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url || "/placeholder.svg"} alt="" width={56} height={56} className="object-cover" />
            ) : (
              <Building2 className="h-7 w-7 text-[#6366F1]" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.full_name || profile?.company_name || "Mon Entreprise"}</h2>
            <p className="text-white/60 text-sm flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {profile?.city || profile?.country || "Afrique"}
            </p>
          </div>
          <Badge className="bg-[#6366F1] text-white">PRO</Badge>
        </div>

        {/* KPI principal */}
        <Card className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total des achats</p>
                <p className="text-3xl font-bold text-white">
                  {stats.totalSpent > 0 ? `${(stats.totalSpent / 1000000).toFixed(1)}M` : "0"} 
                  <span className="text-lg font-normal"> FCFA</span>
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {stats.trend >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-300" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-300" />
                  )}
                  <span className={stats.trend >= 0 ? "text-green-300 text-sm" : "text-red-300 text-sm"}>
                    {Math.abs(stats.trend)}% ce mois
                  </span>
                </div>
              </div>
              <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.slice(-4)}>
                    <Line 
                      type="monotone" 
                      dataKey="montant" 
                      stroke="#fff" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </header>

      <main className="px-4 -mt-4">
        {/* Stats secondaires */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-[#1E293B] border-0">
            <CardContent className="p-4 text-center">
              <ShoppingBag className="h-6 w-6 text-[#6366F1] mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
              <p className="text-xs text-white/60">Commandes</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1E293B] border-0">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-[#10B981] mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.suppliers}</p>
              <p className="text-xs text-white/60">Fournisseurs</p>
            </CardContent>
          </Card>
          <Card className="bg-[#1E293B] border-0">
            <CardContent className="p-4 text-center">
              <Wallet className="h-6 w-6 text-[#F59E0B] mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {stats.avgOrder > 0 ? `${(stats.avgOrder / 1000).toFixed(0)}K` : "0"}
              </p>
              <p className="text-xs text-white/60">Panier moyen</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          <Link href="/agriculture">
            <Button className="bg-[#6366F1] hover:bg-[#5558E3] text-white rounded-xl whitespace-nowrap">
              <Search className="h-4 w-4 mr-2" />
              Explorer le marché
            </Button>
          </Link>
          <Link href="/rfq">
            <Button variant="outline" className="rounded-xl whitespace-nowrap border-[#6366F1] text-[#6366F1] bg-transparent">
              <FileText className="h-4 w-4 mr-2" />
              Demande de devis
            </Button>
          </Link>
          <Link href="/dashboard/commandes">
            <Button variant="outline" className="rounded-xl whitespace-nowrap text-white/80 border-white/20 bg-transparent">
              <Package className="h-4 w-4 mr-2" />
              Commandes
            </Button>
          </Link>
        </div>

        {/* Graphique des dépenses */}
        <Card className="bg-[#1E293B] border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Évolution des achats</h3>
              <Button size="sm" variant="ghost" className="text-white/60">
                <Filter className="h-4 w-4 mr-1" />
                6 mois
              </Button>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1E293B', 
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} FCFA`, 'Montant']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="montant" 
                    stroke="#6366F1" 
                    strokeWidth={3}
                    dot={{ fill: '#6366F1', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#6366F1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Commandes récentes */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Commandes Récentes</h3>
            <Link href="/dashboard/commandes" className="text-[#6366F1] text-sm font-medium flex items-center">
              Voir tout <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <Card className="bg-[#1E293B] border-0">
              <CardContent className="p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-[#6366F1]/30 mx-auto mb-4" />
                <h4 className="font-semibold text-white mb-2">Aucune commande</h4>
                <p className="text-sm text-white/60 mb-4">
                  Explorez le marché pour trouver vos fournisseurs
                </p>
                <Link href="/agriculture">
                  <Button className="bg-[#6366F1]">
                    <Search className="h-4 w-4 mr-2" />
                    Explorer le marché
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 4).map((order) => (
                <Card key={order.id} className="bg-[#1E293B] border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          order.status === 'delivered' ? 'bg-green-500/20' :
                          order.status === 'shipping' ? 'bg-blue-500/20' :
                          'bg-yellow-500/20'
                        }`}>
                          {order.status === 'delivered' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : order.status === 'shipping' ? (
                            <Truck className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white">#{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-white/60">{order.profiles?.full_name || "Fournisseur"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{order.total_amount?.toLocaleString()} FCFA</p>
                        <Badge className={
                          order.status === 'delivered' ? "bg-green-500/20 text-green-400" :
                          order.status === 'shipping' ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }>
                          {order.status === 'delivered' ? 'Livrée' :
                           order.status === 'shipping' ? 'En livraison' :
                           order.status === 'confirmed' ? 'Confirmée' : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Raccourcis */}
        <Card className="bg-gradient-to-r from-[#6366F1]/20 to-[#8B5CF6]/20 border-0">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <Link href="/rfq">
                <Button variant="ghost" className="w-full h-auto py-4 flex flex-col items-center gap-2 text-white hover:bg-white/10">
                  <FileText className="h-6 w-6 text-[#6366F1]" />
                  <span className="text-sm">Demande de devis</span>
                </Button>
              </Link>
              <Link href="/network">
                <Button variant="ghost" className="w-full h-auto py-4 flex flex-col items-center gap-2 text-white hover:bg-white/10">
                  <Users className="h-6 w-6 text-[#10B981]" />
                  <span className="text-sm">Fournisseurs</span>
                </Button>
              </Link>
              <Link href="/dashboard/commandes">
                <Button variant="ghost" className="w-full h-auto py-4 flex flex-col items-center gap-2 text-white hover:bg-white/10">
                  <BarChart3 className="h-6 w-6 text-[#F59E0B]" />
                  <span className="text-sm">Rapports</span>
                </Button>
              </Link>
              <Link href="/messages">
                <Button variant="ghost" className="w-full h-auto py-4 flex flex-col items-center gap-2 text-white hover:bg-white/10">
                  <Building2 className="h-6 w-6 text-[#EC4899]" />
                  <span className="text-sm">Paramètres</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <DashboardNav userType={profile?.user_type} />
    </div>
  )
}
