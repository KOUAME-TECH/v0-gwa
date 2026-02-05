"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MapPin, Users, UserPlus, Loader2, MessageSquare, CheckCircle } from 'lucide-react'
import Link from "next/link"

interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string
  user_type: string
  bio: string
  city: string
  country: string
  is_verified: boolean
  created_at: string
  followers_count?: number
  is_following?: boolean
}

const userTypeLabels: Record<string, string> = {
  producteur: 'Producteur',
  artisan: 'Artisan',
  acheteur: 'Acheteur',
  transformateur: 'Transformateur',
  cooperative: 'Coopérative',
  entreprise: 'Entreprise'
}

const africanCountries = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Ghana",
  "Togo", "Bénin", "Niger", "Guinée", "Cameroun", "Nigeria",
  "Kenya", "Tanzanie", "Ouganda", "Rwanda", "Éthiopie", "Maroc",
  "Tunisie", "Algérie", "Afrique du Sud", "RDC", "Congo"
]

export default function NetworkPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedCountry, setSelectedCountry] = useState("all")
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [selectedType, selectedCountry])

  async function loadData() {
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    let query = supabase
      .from('profiles')
      .select('*')
      .not('id', 'eq', user?.id || '')
      .order('created_at', { ascending: false })
      .limit(50)

    if (selectedType !== 'all') {
      query = query.eq('user_type', selectedType)
    }

    if (selectedCountry !== 'all') {
      query = query.eq('country', selectedCountry)
    }

    const { data: profilesData } = await query

    if (profilesData && user) {
      // Get following status for each profile
      const { data: followingData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = new Set(followingData?.map(f => f.following_id) || [])

      // Get follower counts
      const enrichedProfiles = await Promise.all(profilesData.map(async (profile) => {
        const { count } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profile.id)

        return {
          ...profile,
          followers_count: count || 0,
          is_following: followingIds.has(profile.id)
        }
      }))

      setProfiles(enrichedProfiles)
    } else if (profilesData) {
      setProfiles(profilesData)
    }

    setLoading(false)
  }

  async function toggleFollow(profileId: string, isFollowing: boolean) {
    if (!user) {
      router.push('/auth/login?redirect=/network')
      return
    }

    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId)
    } else {
      await supabase
        .from('followers')
        .insert({
          follower_id: user.id,
          following_id: profileId
        })
    }

    setProfiles(profiles.map(p => 
      p.id === profileId 
        ? { 
            ...p, 
            is_following: !isFollowing,
            followers_count: (p.followers_count || 0) + (isFollowing ? -1 : 1)
          } 
        : p
    ))
  }

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const countries = [...new Set(profiles.map(p => p.country).filter(Boolean))]

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12">
          <div className="container px-4 text-center">
            <Users className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Reseau GWA</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Connectez-vous avec des producteurs, artisans, acheteurs et entreprises 
              a travers toute l'Afrique
            </p>
            
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher des professionnels..."
                  className="pl-10 h-12"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Profiles */}
        <section className="py-8">
          <div className="container px-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type d'acteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(userTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {countries.map(country => (
                    <SelectItem key={country} value={country}>
                      {country?.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto text-sm text-muted-foreground">
                {filteredProfiles.length} membre(s) trouve(s)
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">
                  {searchTerm || selectedType !== "all" || selectedCountry !== "all"
                    ? "Aucun membre trouve"
                    : "Rejoignez notre communaute"
                  }
                </h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  {searchTerm || selectedType !== "all" || selectedCountry !== "all"
                    ? "Essayez de modifier vos filtres ou votre recherche"
                    : "Soyez parmi les premiers membres du reseau GWA. Creez votre profil et connectez-vous avec des professionnels de toute l'Afrique."
                  }
                </p>
                <Link href="/auth/signup">
                  <Button size="lg">Creer mon profil</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProfiles.map((profile) => (
                  <Card key={profile.id} className="hover:shadow-lg transition-all">
                    <CardHeader className="text-center pb-2">
                      <Avatar className="h-20 w-20 mx-auto mb-3">
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback className="text-xl">
                          {profile.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="font-semibold">{profile.full_name || 'Utilisateur'}</h3>
                        {profile.is_verified && (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      
                      <Badge variant="outline" className="mx-auto mt-1">
                        {userTypeLabels[profile.user_type] || profile.user_type}
                      </Badge>
                    </CardHeader>

                    <CardContent className="text-center space-y-3">
                      {profile.city && (
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{profile.city}{profile.country ? `, ${profile.country.toUpperCase()}` : ''}</span>
                        </div>
                      )}

                      {profile.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {profile.bio}
                        </p>
                      )}

                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{profile.followers_count || 0} abonnes</span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button 
                          className="flex-1" 
                          variant={profile.is_following ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleFollow(profile.id, profile.is_following || false)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {profile.is_following ? 'Abonne' : 'Suivre'}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/messages?user=${profile.id}`}>
                            <MessageSquare className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
