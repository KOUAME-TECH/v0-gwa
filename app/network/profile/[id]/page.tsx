"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Users, Award, MessageCircle, Share2, Package, Star, Loader2, ShoppingBag } from 'lucide-react'
import Link from "next/link"

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  user_type: string
  city: string | null
  country: string | null
  is_verified: boolean
  created_at: string
}

interface Product {
  id: string
  name: string
  price: number
  unit: string
  images: string[]
  status: string
}

export default function ProfilePage() {
  const params = useParams()
  const profileId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({ products: 0, followers: 0, rating: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    loadProfile()
  }, [profileId])

  async function loadProfile() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    // Load profile
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (error || !profileData) {
      setLoading(false)
      return
    }

    setProfile(profileData)

    // Load products
    const { data: productsData, count: productsCount } = await supabase
      .from('products')
      .select('id, name, price, unit, images, status', { count: 'exact' })
      .eq('seller_id', profileId)
      .eq('status', 'active')
      .limit(6)

    if (productsData) {
      setProducts(productsData)
    }

    // Load followers count
    const { count: followersCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId)

    // Check if current user follows this profile
    if (user) {
      const { data: followData } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profileId)
        .single()

      setIsFollowing(!!followData)
    }

    // Get average rating from reviews
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('rating')
      .eq('seller_id', profileId)

    const avgRating = reviewsData && reviewsData.length > 0
      ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length
      : 0

    setStats({
      products: productsCount || 0,
      followers: followersCount || 0,
      rating: avgRating
    })

    setLoading(false)
  }

  async function handleFollow() {
    if (!currentUser || !profile) return

    const supabase = createClient()

    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
      
      setIsFollowing(false)
      setStats(s => ({ ...s, followers: s.followers - 1 }))
    } else {
      await supabase
        .from('followers')
        .insert({
          follower_id: currentUser.id,
          following_id: profile.id
        })
      
      setIsFollowing(true)
      setStats(s => ({ ...s, followers: s.followers + 1 }))
    }
  }

  const getCountryName = (code: string | null) => {
    const countries: Record<string, string> = {
      'CI': 'Cote d\'Ivoire', 'SN': 'Senegal', 'ML': 'Mali', 'BF': 'Burkina Faso',
      'GH': 'Ghana', 'TG': 'Togo', 'BJ': 'Benin', 'NE': 'Niger', 'NG': 'Nigeria',
      'CM': 'Cameroun', 'GA': 'Gabon', 'CG': 'Congo', 'CD': 'RD Congo', 'TZ': 'Tanzanie'
    }
    return code ? countries[code] || code : ''
  }

  const getUserTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'producteur': 'Producteur', 'artisan': 'Artisan', 'acheteur': 'Acheteur',
      'cooperative': 'Coopérative', 'entreprise': 'Entreprise', 'transformateur': 'Transformateur'
    }
    return types[type] || type
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

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Profil non trouve</h1>
            <p className="text-muted-foreground mb-4">Ce profil n'existe pas ou a ete supprime.</p>
            <Link href="/network">
              <Button>Retour au reseau</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="flex-1 bg-muted/30">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border-b">
          <div className="container px-4 py-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-32 w-32 border-4 border-background">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-3xl">
                  {profile.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl font-bold">{profile.full_name || 'Utilisateur'}</h1>
                      {profile.is_verified && (
                        <Badge className="bg-primary">
                          <Award className="h-3 w-3 mr-1" />
                          Verifie
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="mb-2">
                      {getUserTypeLabel(profile.user_type)}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {currentUser && currentUser.id !== profile.id && (
                      <>
                        <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"}>
                          <Users className="h-4 w-4 mr-2" />
                          {isFollowing ? 'Abonne' : 'Suivre'}
                        </Button>
                        <Link href={`/messages?to=${profile.id}`}>
                          <Button variant="outline">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        </Link>
                      </>
                    )}
                    <Button variant="outline" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  {(profile.city || profile.country) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {[profile.city, getCountryName(profile.country)].filter(Boolean).join(', ')}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    {stats.products} produits
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {stats.followers} abonnes
                  </div>
                  {stats.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      {stats.rating.toFixed(1)}
                    </div>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container px-4 py-8">
          <Tabs defaultValue="products" className="space-y-6">
            <TabsList>
              <TabsTrigger value="products">Produits</TabsTrigger>
              <TabsTrigger value="about">A propos</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              {products.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Aucun produit</h3>
                    <p className="text-muted-foreground">
                      Ce vendeur n'a pas encore ajoute de produits.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <Link key={product.id} href={`/produit/${product.id}`}>
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                        <div className="aspect-square bg-muted relative">
                          {product.images && product.images[0] ? (
                            <img 
                              src={product.images[0] || "/placeholder.svg"} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium line-clamp-1">{product.name}</h3>
                          <p className="text-primary font-bold mt-1">
                            {product.price.toLocaleString()} FCFA/{product.unit}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="about">
              <Card>
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Type de compte</h4>
                    <p className="text-muted-foreground">{getUserTypeLabel(profile.user_type)}</p>
                  </div>
                  {(profile.city || profile.country) && (
                    <div>
                      <h4 className="font-medium mb-1">Localisation</h4>
                      <p className="text-muted-foreground">
                        {[profile.city, getCountryName(profile.country)].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {profile.bio && (
                    <div>
                      <h4 className="font-medium mb-1">Description</h4>
                      <p className="text-muted-foreground">{profile.bio}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium mb-1">Membre depuis</h4>
                    <p className="text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString('fr-FR', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
