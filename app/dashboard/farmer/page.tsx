"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Sprout, CloudSun, TrendingUp, Package, Users, Wallet, 
  Plus, ChevronRight, Truck, Bell, Sun, Droplets, Wind,
  ArrowLeft, MoreVertical, Eye, Edit2, BarChart3
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { DashboardNav } from "@/components/dashboard-nav"
import { WeatherWidget } from "@/components/weather-widget"
import { isFactoringEligible } from "@/lib/factoring/eligibility"
import { Banknote } from "lucide-react"
import { getCoachActions } from "@/lib/scg/coach"
import { ScgCoachPanel } from "@/components/scg/scg-coach"
import type { SCGDimensions } from "@/lib/scg/engine"

interface Product {
  id: string
  name: string
  price: number
  unit: string
  stock_quantity: number
  images: string[]
  status: string
  origin_region: string | null
}

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  profiles: { full_name: string } | null
}

export default function FarmerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0
  })
  const [coachDims, setCoachDims] = useState<SCGDimensions | null>(null)
  const [coachScore, setCoachScore] = useState(0)
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

      // Produits
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, unit, images, description, origin_country, origin_region, is_organic, is_fair_trade, product_type, seller_id, category_id, status, likes_count, comments_count, shares_count, created_at, updated_at, stock_quantity')
        .eq('seller_id', authUser.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
      if (productsError) console.error('[dashboard/farmer products]', productsError.message)
      setProducts(productsData || [])

      // Commandes (en tant que vendeur via order_items)
      const productIds = productsData?.map(p => p.id) || []
      let ordersData: Order[] = []
      
      if (productIds.length > 0) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('order_id')
          .in('product_id', productIds)
        
        const orderIds = [...new Set(orderItems?.map(oi => oi.order_id) || [])]
        
        if (orderIds.length > 0) {
          const { data: ordersResult } = await supabase
            .from('orders')
            .select('*, profiles:buyer_id(full_name)')
            .in('id', orderIds)
            .order('created_at', { ascending: false })
            .limit(5)
          ordersData = ordersResult || []
        }
      }
      setOrders(ordersData)

      // Stats
      const totalRevenue = ordersData.reduce((sum, o) => 
        o.status === 'delivered' ? sum + (o.total_amount || 0) : sum, 0)
      const pendingOrders = ordersData.filter(o => 
        ['pending', 'confirmed', 'shipping'].includes(o.status)).length

      setStats({
        totalRevenue,
        totalProducts: productsData?.length || 0,
        totalOrders: ordersData.length,
        pendingOrders
      })

      const { data: scg } = await supabase
        .from("scg_scores")
        .select(
          "score_total, dim_fiabilite, dim_qualite, dim_engagement, dim_volumes, dim_stabilite",
        )
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (scg) {
        setCoachScore(scg.score_total || 0)
        setCoachDims({
          fiabilite: scg.dim_fiabilite || 0,
          qualite: scg.dim_qualite || 0,
          engagement: scg.dim_engagement || 0,
          volumes: scg.dim_volumes || 0,
          stabilite: scg.dim_stabilite || 0,
        })
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F7D32]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header Producteur - Vert nature */}
      <header className="bg-gradient-to-br from-[#2F7D32] to-[#1B5E20] text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Espace Producteur</h1>
          <Link href="/notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        {/* Profil */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url || "/placeholder.svg"} alt="" width={64} height={64} className="object-cover" />
            ) : (
              <Sprout className="h-8 w-8 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.full_name || "Producteur"}</h2>
            <p className="text-white/80 text-sm">{profile?.city || profile?.country || "Afrique"}</p>
            {profile?.is_verified && (
              <Badge className="bg-white/20 text-white mt-1">Certifié GWA</Badge>
            )}
          </div>
        </div>

      </header>

      <main className="px-4 -mt-4">
        {/* Météo réelle (Open-Meteo via /api/weather) */}
        <div className="mb-4">
          <WeatherWidget />
        </div>

        {coachDims && (
          <div className="mb-6">
            <ScgCoachPanel
              score={coachScore || profile?.scg_score || 0}
              actions={getCoachActions(coachDims)}
            />
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="h-8 w-8 text-[#2F7D32] bg-[#2F7D32]/10 p-1.5 rounded-lg" />
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-[#111827]">
                {stats.totalRevenue > 0 ? `${(stats.totalRevenue / 1000).toFixed(0)}K` : "0"}
              </p>
              <p className="text-xs text-[#4B5563]">Revenus (FCFA)</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Package className="h-8 w-8 text-[#F39A1F] bg-[#F39A1F]/10 p-1.5 rounded-lg" />
                <span className="text-xs text-[#4B5563]">{products.filter(p => p.status === 'active').length} actifs</span>
              </div>
              <p className="text-2xl font-bold text-[#111827]">{stats.totalProducts}</p>
              <p className="text-xs text-[#4B5563]">Produits</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Truck className="h-8 w-8 text-blue-500 bg-blue-500/10 p-1.5 rounded-lg" />
                {stats.pendingOrders > 0 && (
                  <Badge className="bg-red-500 text-white text-xs">{stats.pendingOrders}</Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-[#111827]">{stats.totalOrders}</p>
              <p className="text-xs text-[#4B5563]">Commandes</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 text-purple-500 bg-purple-500/10 p-1.5 rounded-lg" />
              </div>
              <p className="text-2xl font-bold text-[#111827]">
                {new Set(orders.map(o => o.profiles?.full_name).filter(Boolean)).size}
              </p>
              <p className="text-xs text-[#4B5563]">Clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          <Link href="/publier">
            <Button className="bg-[#2F7D32] hover:bg-[#1B5E20] text-white rounded-full whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter produit
            </Button>
          </Link>
          <Link href="/dashboard/commandes">
            <Button variant="outline" className="rounded-full whitespace-nowrap border-[#2F7D32] text-[#2F7D32] bg-transparent">
              <Truck className="h-4 w-4 mr-2" />
              Commandes
            </Button>
          </Link>
          <Link href="/messages">
            <Button variant="outline" className="rounded-full whitespace-nowrap bg-transparent">
              Messages
            </Button>
          </Link>
        </div>

        {/* Bloc affacturage (préfinancement) — visible selon éligibilité SCG */}
        <Link href="/affacturage" className="block mb-6">
          <Card className="bg-white border-0 shadow-sm overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#2F7D32]/10 flex items-center justify-center flex-shrink-0">
                  <Banknote className="h-6 w-6 text-[#2F7D32]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-[#111827]">Affacturage</h4>
                    {isFactoringEligible({
                      scg_bancable: profile?.scg_bancable,
                      scg_score: profile?.scg_score,
                    }) ? (
                      <Badge className="bg-green-100 text-green-700">Éligible</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">Score requis</Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#4B5563]">
                    {isFactoringEligible({
                      scg_bancable: profile?.scg_bancable,
                      scg_score: profile?.scg_score,
                    })
                      ? "Obtenez une avance de trésorerie sur vos ventes."
                      : "Améliorez votre Score de Confiance GWA pour y accéder."}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-[#4B5563]" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Mes Produits */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827]">Mes Produits</h3>
            <Link href="/dashboard/products" className="text-[#2F7D32] text-sm font-medium flex items-center">
              Voir tout <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {products.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Sprout className="h-12 w-12 text-[#2F7D32]/30 mx-auto mb-4" />
                <h4 className="font-semibold text-[#111827] mb-2">Aucun produit</h4>
                <p className="text-sm text-[#4B5563] mb-4">
                  Commencez à vendre vos récoltes
                </p>
                <Link href="/publier">
                  <Button className="bg-[#2F7D32]">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un produit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 4).map((product) => (
                <Card key={product.id} className="bg-white border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center">
                      <Link
                        href={`/produit/${product.id}`}
                        className="w-20 h-20 bg-[#FFF6E5] flex-shrink-0 active:opacity-80"
                        aria-label={`Voir ${product.name}`}
                      >
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0] || "/placeholder.svg"}
                            alt={product.name}
                            width={80}
                            height={80}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sprout className="h-8 w-8 text-[#2F7D32]/30" />
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/produit/${product.id}`} className="min-w-0 flex-1 active:opacity-80">
                            <h4 className="font-semibold text-[#111827] line-clamp-1">{product.name}</h4>
                            <p className="text-sm text-[#2F7D32] font-medium">
                              {product.price.toLocaleString()} FCFA/{product.unit}
                            </p>
                          </Link>
                          <Badge 
                            className={product.status === 'active' 
                              ? "bg-green-100 text-green-700" 
                              : "bg-gray-100 text-gray-600"}
                          >
                            {product.status === 'active' ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-[#4B5563]">
                            Stock: {product.stock_quantity} {product.unit}
                          </p>
                          <div className="flex gap-1">
                            <Link href={`/produit/${product.id}`} aria-label="Voir le produit">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Eye className="h-4 w-4 text-[#4B5563]" />
                              </Button>
                            </Link>
                            <Link href={`/dashboard/products/${product.id}/edit`} aria-label="Modifier le produit">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Edit2 className="h-4 w-4 text-[#4B5563]" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Commandes récentes */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827]">Commandes Récentes</h3>
            <Link href="/dashboard/commandes" className="text-[#2F7D32] text-sm font-medium flex items-center">
              Voir tout <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <Truck className="h-10 w-10 text-[#4B5563]/30 mx-auto mb-3" />
                <p className="text-sm text-[#4B5563]">Aucune commande pour le moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 3).map((order) => (
                <Card key={order.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#111827]">#{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-[#4B5563]">{order.profiles?.full_name || 'Client'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#2F7D32]">{order.total_amount?.toLocaleString()} FCFA</p>
                        <Badge className={
                          order.status === 'delivered' ? "bg-green-100 text-green-700" :
                          order.status === 'shipping' ? "bg-blue-100 text-blue-700" :
                          "bg-yellow-100 text-yellow-700"
                        }>
                          {order.status === 'delivered' ? 'Livré' :
                           order.status === 'shipping' ? 'En cours' :
                           order.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Conseils */}
        <Card className="bg-gradient-to-r from-[#2F7D32]/10 to-[#F39A1F]/10 border-0">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2F7D32] flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">Conseil du jour</h4>
                <p className="text-sm text-[#4B5563]">
                  Ajoutez des photos de qualité pour augmenter vos ventes de 40%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <DashboardNav userType={profile?.user_type} />
    </div>
  )
}
