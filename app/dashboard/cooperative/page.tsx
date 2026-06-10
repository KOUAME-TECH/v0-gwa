"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Users, TrendingUp, Package, Wallet, MapPin, Bell, ArrowLeft,
  ChevronRight, UserPlus, FileText, BarChart3, Settings,
  Building2, Sprout, Hammer, CheckCircle2, AlertCircle, Globe
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { DashboardNav } from "@/components/dashboard-nav"

interface Member {
  id: string
  full_name: string
  user_type: string
  city: string
  is_verified: boolean
  avatar_url: string | null
  products_count?: number
}

export default function CooperativeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalMembers: 0,
    totalProducts: 0,
    farmers: 0,
    artisans: 0
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

      // Membres de la région
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .in('user_type', ['farmer', 'artisan'])
        .eq('country', profileData?.country || '')
        .order('created_at', { ascending: false })
        .limit(10)

      if (membersData) {
        // Compter les produits par membre
        const membersWithProducts = await Promise.all(
          membersData.map(async (member) => {
            const { count } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('seller_id', member.id)
              .eq('status', 'active')
            return { ...member, products_count: count || 0 }
          })
        )
        setMembers(membersWithProducts)
      }

      // Stats
      const farmers = membersData?.filter(m => m.user_type === 'farmer').length || 0
      const artisans = membersData?.filter(m => m.user_type === 'artisan').length || 0

      setStats({
        totalRevenue: 0,
        totalMembers: membersData?.length || 0,
        totalProducts: 0,
        farmers,
        artisans
      })

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0FDF4] pb-20">
      {/* Header Coopérative - Vert émeraude */}
      <header className="bg-gradient-to-br from-[#059669] to-[#047857] text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Espace Coopérative</h1>
          <Link href="/notifications">
            <Bell className="h-6 w-6" />
          </Link>
        </div>

        {/* Info coopérative */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url || "/placeholder.svg"} alt="" width={64} height={64} className="object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.full_name || "Ma Coopérative"}</h2>
            <p className="text-white/80 text-sm flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {profile?.city || profile?.country || "Afrique"}
            </p>
            {profile?.is_verified && (
              <Badge className="bg-white/20 text-white mt-1">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Certifiée
              </Badge>
            )}
          </div>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Users className="h-6 w-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalMembers}</p>
            <p className="text-xs text-white/70">Membres</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Sprout className="h-6 w-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.farmers}</p>
            <p className="text-xs text-white/70">Producteurs</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <Hammer className="h-6 w-6 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.artisans}</p>
            <p className="text-xs text-white/70">Artisans</p>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-4">
        {/* Actions rapides */}
        <Card className="bg-white border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2">
              <button className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#059669]/10 flex items-center justify-center mx-auto mb-1">
                  <UserPlus className="h-6 w-6 text-[#059669]" />
                </div>
                <p className="text-xs text-[#4B5563]">Inviter</p>
              </button>
              <Link href="/dashboard/products" className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F39A1F]/10 flex items-center justify-center mx-auto mb-1">
                  <Package className="h-6 w-6 text-[#F39A1F]" />
                </div>
                <p className="text-xs text-[#4B5563]">Produits</p>
              </Link>
              <button className="text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-1">
                  <FileText className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-xs text-[#4B5563]">Rapports</p>
              </button>
              <button className="text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-1">
                  <BarChart3 className="h-6 w-6 text-purple-500" />
                </div>
                <p className="text-xs text-[#4B5563]">Stats</p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Répartition des membres */}
        <Card className="bg-white border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <h3 className="font-bold text-[#111827] mb-4">Répartition des Membres</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-[#2F7D32]" />
                    Producteurs
                  </span>
                  <span className="font-medium">{stats.farmers} ({stats.totalMembers > 0 ? Math.round((stats.farmers / stats.totalMembers) * 100) : 0}%)</span>
                </div>
                <div className="h-3 rounded-full bg-[#F0FDF4] overflow-hidden">
                  <div 
                    className="h-full bg-[#2F7D32] rounded-full transition-all" 
                    style={{ width: `${stats.totalMembers > 0 ? (stats.farmers / stats.totalMembers) * 100 : 0}%` }} 
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <Hammer className="h-4 w-4 text-[#8B4513]" />
                    Artisans
                  </span>
                  <span className="font-medium">{stats.artisans} ({stats.totalMembers > 0 ? Math.round((stats.artisans / stats.totalMembers) * 100) : 0}%)</span>
                </div>
                <div className="h-3 rounded-full bg-[#FFF6E5] overflow-hidden">
                  <div 
                    className="h-full bg-[#8B4513] rounded-full transition-all" 
                    style={{ width: `${stats.totalMembers > 0 ? (stats.artisans / stats.totalMembers) * 100 : 0}%` }} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des membres */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#059669]" />
              Membres
            </h3>
            <Button variant="outline" size="sm" className="rounded-full border-[#059669] text-[#059669] bg-transparent">
              <UserPlus className="h-4 w-4 mr-1" />
              Inviter
            </Button>
          </div>

          {members.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-[#059669]/30 mx-auto mb-4" />
                <h4 className="font-semibold text-[#111827] mb-2">Aucun membre</h4>
                <p className="text-sm text-[#4B5563] mb-4">
                  Invitez des producteurs et artisans à rejoindre votre coopérative
                </p>
                <Button className="bg-[#059669]">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Inviter des membres
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <Card key={member.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#F0FDF4] flex items-center justify-center overflow-hidden">
                        {member.avatar_url ? (
                          <Image src={member.avatar_url || "/placeholder.svg"} alt="" width={48} height={48} className="object-cover" />
                        ) : (
                          <span className="text-[#059669] font-bold">
                            {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#111827]">{member.full_name || "Membre"}</p>
                          {member.is_verified && (
                            <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge className={
                            member.user_type === 'farmer' 
                              ? "bg-[#2F7D32]/10 text-[#2F7D32]" 
                              : "bg-[#8B4513]/10 text-[#8B4513]"
                          }>
                            {member.user_type === 'farmer' ? 'Producteur' : 'Artisan'}
                          </Badge>
                          <span className="text-xs text-[#4B5563] flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {member.city || "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#111827]">{member.products_count || 0}</p>
                        <p className="text-xs text-[#4B5563]">produits</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Alertes */}
        <Card className="bg-white border-0 shadow-sm border-l-4 border-l-yellow-500 mb-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">À faire</h4>
                <ul className="text-sm text-[#4B5563] space-y-1">
                  {members.filter(m => !m.is_verified).length > 0 && (
                    <li>• {members.filter(m => !m.is_verified).length} membre(s) en attente de vérification</li>
                  )}
                  <li>• Complétez le profil de la coopérative</li>
                  <li>• Ajoutez une photo de couverture</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paramètres */}
        <Card className="bg-gradient-to-r from-[#059669]/10 to-[#10B981]/10 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-[#059669]" />
                <div>
                  <h4 className="font-semibold text-[#111827]">Paramètres</h4>
                  <p className="text-sm text-[#4B5563]">Gérez votre coopérative</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#4B5563]" />
            </div>
          </CardContent>
        </Card>
      </main>

      <DashboardNav userType={profile?.user_type} />
    </div>
  )
}
