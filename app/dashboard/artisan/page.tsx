"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Palette, Star, Package, Wallet, Users, Plus, ChevronRight, 
  Bell, ArrowLeft, MessageSquare, Award, Hammer, Eye,
  Sparkles, TrendingUp, Clock, Heart
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { BottomNav } from "@/components/bottom-nav"

interface Product {
  id: string
  name: string
  price: number
  unit: string
  images: string[]
  status: string
}

interface Review {
  id: string
  rating: number
  comment: string
  created_at: string
  profiles: { full_name: string } | null
}

export default function ArtisanDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProducts: 0,
    avgRating: 0,
    totalReviews: 0,
    totalOrders: 0
  })
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

      // Produits artisanaux
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', authUser.id)
        .order('created_at', { ascending: false })
      setProducts(productsData || [])

      // Avis
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, profiles:user_id(full_name)')
        .eq('seller_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setReviews(reviewsData || [])

      // Stats
      const avgRating = reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length
        : 0

      setStats({
        totalRevenue: 0,
        totalProducts: productsData?.length || 0,
        avgRating,
        totalReviews: reviewsData?.length || 0,
        totalOrders: 0
      })

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header Artisan - Couleur terre/artisanat */}
      <header className="bg-gradient-to-br from-[#8B4513] to-[#5D2E0C] text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Espace Artisan</h1>
          <Link href="/notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        {/* Profil artisan */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url || "/placeholder.svg"} alt="" width={64} height={64} className="object-cover" />
            ) : (
              <Palette className="h-8 w-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.full_name || "Artisan"}</h2>
            <p className="text-white/80 text-sm">{profile?.speciality || "Artisanat traditionnel"}</p>
            <div className="flex items-center gap-2 mt-1">
              {profile?.is_verified && (
                <Badge className="bg-[#F39A1F] text-white">
                  <Award className="h-3 w-3 mr-1" />
                  Certifié
                </Badge>
              )}
              {stats.avgRating > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{stats.avgRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalProducts}</p>
            <p className="text-xs text-white/70">Créations</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalReviews}</p>
            <p className="text-xs text-white/70">Avis</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-white/70">Commandes</p>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-4">
        {/* Actions rapides */}
        <Card className="bg-white border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2">
              <Link href="/dashboard/products/new" className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#8B4513]/10 flex items-center justify-center mx-auto mb-1">
                  <Plus className="h-6 w-6 text-[#8B4513]" />
                </div>
                <p className="text-xs text-[#4B5563]">Ajouter</p>
              </Link>
              <Link href="/dashboard/products" className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F39A1F]/10 flex items-center justify-center mx-auto mb-1">
                  <Package className="h-6 w-6 text-[#F39A1F]" />
                </div>
                <p className="text-xs text-[#4B5563]">Produits</p>
              </Link>
              <Link href="/dashboard/commandes" className="text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-1">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-xs text-[#4B5563]">Commandes</p>
              </Link>
              <Link href="/messages" className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-1">
                  <MessageSquare className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-xs text-[#4B5563]">Messages</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Mes Créations */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#F39A1F]" />
              Mes Créations
            </h3>
            <Link href="/dashboard/products" className="text-[#8B4513] text-sm font-medium flex items-center">
              Voir tout <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {products.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Hammer className="h-12 w-12 text-[#8B4513]/30 mx-auto mb-4" />
                <h4 className="font-semibold text-[#111827] mb-2">Aucune création</h4>
                <p className="text-sm text-[#4B5563] mb-4">
                  Partagez votre savoir-faire avec le monde
                </p>
                <Link href="/dashboard/products/new">
                  <Button className="bg-[#8B4513]">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une création
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 4).map((product) => (
                <Card key={product.id} className="bg-white border-0 shadow-sm overflow-hidden">
                  <div className="aspect-square bg-[#FFF6E5] relative">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0] || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Palette className="h-10 w-10 text-[#8B4513]/30" />
                      </div>
                    )}
                    <Badge className={`absolute top-2 right-2 ${
                      product.status === 'active' 
                        ? "bg-green-500 text-white" 
                        : "bg-gray-500 text-white"
                    }`}>
                      {product.status === 'active' ? 'En vente' : 'Inactif'}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-[#111827] text-sm line-clamp-1">{product.name}</h4>
                    <p className="text-[#8B4513] font-bold text-sm">
                      {product.price.toLocaleString()} FCFA
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Avis Clients */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Avis Clients
            </h3>
          </div>

          {reviews.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <Star className="h-10 w-10 text-yellow-500/30 mx-auto mb-3" />
                <p className="text-sm text-[#4B5563]">Vos premiers avis apparaîtront ici</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 3).map((review) => (
                <Card key={review.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#8B4513]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#8B4513] font-bold text-sm">
                          {review.profiles?.full_name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-[#111827] text-sm">
                            {review.profiles?.full_name || "Client"}
                          </p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`h-3 w-3 ${
                                  i < review.rating 
                                    ? "text-yellow-500 fill-yellow-500" 
                                    : "text-gray-300"
                                }`} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-[#4B5563] line-clamp-2">{review.comment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Certification */}
        {!profile?.is_verified && (
          <Card className="bg-gradient-to-r from-[#8B4513] to-[#F39A1F] border-0">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">Devenez Artisan Certifié</h4>
                <p className="text-sm text-white/80">
                  Augmentez votre visibilité et gagnez la confiance des acheteurs
                </p>
              </div>
              <Button size="sm" className="bg-white text-[#8B4513]">
                Demander
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
