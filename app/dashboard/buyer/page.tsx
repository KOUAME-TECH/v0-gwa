"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  ShoppingBag, Heart, Package, Truck, Search, Bell, ArrowLeft,
  ChevronRight, MapPin, Star, Clock, CheckCircle2, Filter,
  Wallet, TrendingUp, Store
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { DashboardNav } from "@/components/dashboard-nav"

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  order_items: {
    products: {
      name: string
      images: string[]
      profiles: { full_name: string } | null
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
    profiles: { full_name: string } | null
  }
}

export default function BuyerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalOrders: 0,
    totalFavorites: 0,
    pendingOrders: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

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

      // Commandes
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id, total_amount, status, created_at,
          order_items(products(name, images, profiles:seller_id(full_name)))
        `)
        .eq('buyer_id', authUser.id)
        .order('created_at', { ascending: false })
      setOrders(ordersData || [])

      // Favoris
      const { data: favoritesData } = await supabase
        .from('favorites')
        .select(`
          id,
          product:product_id(id, name, price, unit, images, profiles:seller_id(full_name))
        `)
        .eq('user_id', authUser.id)
        .limit(4)
      setFavorites(favoritesData as any || [])

      // Recommandations
      const { data: recoData } = await supabase
        .from('products')
        .select(`id, name, price, unit, images, origin_region, profiles:seller_id(full_name, city)`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6)
      setRecommendations(recoData || [])

      // Stats
      const totalSpent = ordersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const pendingOrders = ordersData?.filter(o => 
        ['pending', 'confirmed', 'shipping'].includes(o.status)).length || 0

      setStats({
        totalSpent,
        totalOrders: ordersData?.length || 0,
        totalFavorites: favoritesData?.length || 0,
        pendingOrders
      })

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/agriculture?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header Acheteur - Bleu moderne */}
      <header className="bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Espace Acheteur</h1>
          <Link href="/notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        {/* Profil */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url || "/placeholder.svg"} alt="" width={56} height={56} className="object-cover" />
            ) : (
              <ShoppingBag className="h-7 w-7 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.full_name || "Acheteur"}</h2>
            <p className="text-white/80 text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {profile?.city || profile?.country || "Afrique"}
            </p>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#4B5563]" />
          <Input
            placeholder="Rechercher produits, vendeurs..."
            className="pl-12 pr-12 py-6 rounded-2xl bg-white text-[#111827] border-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            size="sm" 
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#3B82F6]"
            onClick={handleSearch}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 -mt-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#111827]">
                    {stats.totalSpent > 0 ? `${(stats.totalSpent / 1000).toFixed(0)}K` : "0"}
                  </p>
                  <p className="text-xs text-[#4B5563]">Total dépensé</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#111827]">{stats.totalOrders}</p>
                  <p className="text-xs text-[#4B5563]">Commandes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#111827]">{stats.totalFavorites}</p>
                  <p className="text-xs text-[#4B5563]">Favoris</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#111827]">{stats.pendingOrders}</p>
                  <p className="text-xs text-[#4B5563]">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Catégories rapides */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          <Link href="/agriculture">
            <Button className="bg-[#2F7D32] text-white rounded-full whitespace-nowrap">
              <Store className="h-4 w-4 mr-2" />
              Agriculture
            </Button>
          </Link>
          <Link href="/cooperatives">
            <Button variant="outline" className="rounded-full whitespace-nowrap bg-transparent">
              Coopératives
            </Button>
          </Link>
          <Link href="/panier">
            <Button variant="outline" className="rounded-full whitespace-nowrap bg-transparent">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Panier
            </Button>
          </Link>
        </div>

        {/* Commandes en cours */}
        {stats.pendingOrders > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#3B82F6]" />
                Commandes en cours
              </h3>
              <Link href="/dashboard/commandes" className="text-[#3B82F6] text-sm font-medium flex items-center">
                Voir tout <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {orders.filter(o => ['pending', 'confirmed', 'shipping'].includes(o.status)).slice(0, 2).map((order) => (
                <Card key={order.id} className="bg-white border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
                        {order.order_items?.[0]?.products?.images?.[0] ? (
                          <Image
                            src={order.order_items[0].products.images[0] || "/placeholder.svg"}
                            alt=""
                            width={64}
                            height={64}
                            className="object-cover"
                          />
                        ) : (
                          <Package className="h-8 w-8 text-[#4B5563]/30" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[#111827] line-clamp-1">
                          {order.order_items?.[0]?.products?.name || "Commande"}
                        </p>
                        <p className="text-sm text-[#4B5563]">
                          {order.order_items?.[0]?.products?.profiles?.full_name || "Vendeur"}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-bold text-[#3B82F6]">
                            {order.total_amount?.toLocaleString()} FCFA
                          </p>
                          <Badge className={
                            order.status === 'shipping' ? "bg-blue-100 text-blue-700" :
                            order.status === 'confirmed' ? "bg-green-100 text-green-700" :
                            "bg-yellow-100 text-yellow-700"
                          }>
                            {order.status === 'shipping' ? 'En livraison' :
                             order.status === 'confirmed' ? 'Confirmée' : 'En attente'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Mes Favoris */}
        {favorites.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                Mes Favoris
              </h3>
              <Link href="/agriculture" className="text-[#3B82F6] text-sm font-medium flex items-center">
                Voir tout <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {favorites.map((fav) => (
                <Card key={fav.id} className="bg-white border-0 shadow-sm min-w-[150px] flex-shrink-0">
                  <div className="aspect-square bg-[#F8FAFC] relative">
                    {fav.product?.images?.[0] ? (
                      <Image
                        src={fav.product.images[0] || "/placeholder.svg"}
                        alt={fav.product.name}
                        fill
                        className="object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-[#4B5563]/30" />
                      </div>
                    )}
                    <Heart className="absolute top-2 right-2 h-5 w-5 text-red-500 fill-red-500" />
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-[#111827] text-sm line-clamp-1">{fav.product?.name}</p>
                    <p className="text-[#3B82F6] font-bold text-sm">
                      {fav.product?.price?.toLocaleString()} FCFA
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Produits recommandés */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Pour vous
            </h3>
            <Link href="/agriculture" className="text-[#3B82F6] text-sm font-medium flex items-center">
              Voir plus <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {recommendations.slice(0, 4).map((product) => (
              <Link key={product.id} href={`/produit/${product.id}`}>
                <Card className="bg-white border-0 shadow-sm overflow-hidden">
                  <div className="aspect-square bg-[#F8FAFC] relative">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0] || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-[#4B5563]/30" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-[#111827] text-sm line-clamp-1">{product.name}</p>
                    <p className="text-xs text-[#4B5563] line-clamp-1">
                      {product.profiles?.full_name}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[#2F7D32] font-bold text-sm">
                        {product.price?.toLocaleString()} FCFA
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Historique commandes */}
        {orders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111827]">Historique</h3>
              <Link href="/dashboard/commandes" className="text-[#3B82F6] text-sm font-medium flex items-center">
                Voir tout <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {orders.filter(o => o.status === 'delivered').slice(0, 3).map((order) => (
                <Card key={order.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#111827] text-sm">#{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-[#4B5563]">
                            {new Date(order.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-[#111827]">{order.total_amount?.toLocaleString()} FCFA</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <DashboardNav userType={profile?.user_type} />
    </div>
  )
}
