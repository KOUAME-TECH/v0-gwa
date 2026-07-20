"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, MapPin, MessageCircle, UserPlus, UserCheck, 
  BadgeCheck, Package, Star, Calendar, Loader2 
} from "lucide-react"
import { toast } from "sonner"

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  created_at: string
}

export default function PublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const profileId = params.id as string
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [stats, setStats] = useState({ followers: 0, following: 0, products: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user?.id || null)

      // Load profile
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single()

      if (!p) { router.replace("/"); return }
      setProfile(p)

      // Load stats
      const [followersRes, followingRes, productsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("following_id", profileId),
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("follower_id", profileId),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("seller_id", profileId),
      ])
      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        products: productsRes.count || 0,
      })

      // Check if following
      if (user) {
        const { data: f } = await supabase.from("followers")
          .select("id").eq("follower_id", user.id).eq("following_id", profileId).maybeSingle()
        setIsFollowing(!!f)
      }

      setLoading(false)
    }
    load()
  }, [profileId])

  async function toggleFollow() {
    if (!currentUser) { router.push("/auth/login"); return }
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from("followers").delete().eq("follower_id", currentUser).eq("following_id", profileId)
      setIsFollowing(false)
      setStats(p => ({ ...p, followers: p.followers - 1 }))
    } else {
      await supabase.from("followers").insert({ follower_id: currentUser, following_id: profileId })
      setIsFollowing(true)
      setStats(p => ({ ...p, followers: p.followers + 1 }))
    }
    setFollowLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  if (!profile) return null

  const isOwnProfile = currentUser === profileId

  const userTypeLabels: Record<string, string> = {
    farmer: "Agriculteur", buyer: "Acheteur",
    cooperative: "Cooperative", business: "Entreprise",
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2F7D32] to-[#1B5E20] text-white">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 safe-top">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Profil</h1>
        </div>

        <div className="flex flex-col items-center px-4 pb-6 pt-2">
          <Avatar className="h-24 w-24 border-4 border-white/30 mb-3">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="bg-white/20 text-white text-2xl">
              {profile.full_name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className="text-xl font-bold">{profile.full_name}</h2>
            {profile.is_verified && <BadgeCheck className="h-5 w-5 text-yellow-300" />}
          </div>
          {profile.user_type && (
            <Badge className="bg-white/20 text-white border-0 mb-1">
              {userTypeLabels[profile.user_type] || profile.user_type}
            </Badge>
          )}
          {profile.city && (
            <p className="text-white/80 text-sm flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {profile.city}{profile.country ? `, ${profile.country}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-neutral-200">
        <div className="flex justify-around py-4">
          <div className="text-center">
            <p className="text-xl font-bold text-[#111827]">{stats.followers}</p>
            <p className="text-xs text-neutral-500">Abonnes</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#111827]">{stats.following}</p>
            <p className="text-xs text-neutral-500">Abonnements</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#111827]">{stats.products}</p>
            <p className="text-xs text-neutral-500">Produits</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isOwnProfile && (
        <div className="flex gap-3 px-4 py-4 bg-white border-b border-neutral-200">
          <Button 
            onClick={toggleFollow} 
            disabled={followLoading}
            className={`flex-1 rounded-full h-11 font-semibold ${
              isFollowing 
                ? "bg-neutral-100 text-[#111827] hover:bg-neutral-200 border border-neutral-300" 
                : "bg-[#F39A1F] hover:bg-[#D4860D] text-white"
            }`}
          >
            {followLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
              isFollowing ? <><UserCheck className="h-4 w-4 mr-2" />Abonne</> : <><UserPlus className="h-4 w-4 mr-2" />Suivre</>
            }
          </Button>
          <Link href={`/messages?to=${profileId}`} className="flex-1">
            <Button variant="outline" className="w-full rounded-full h-11 font-semibold bg-transparent border-[#2F7D32] text-[#2F7D32]">
              <MessageCircle className="h-4 w-4 mr-2" />
              Message
            </Button>
          </Link>
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <div className="px-4 py-4 bg-white border-b border-neutral-200">
          <p className="text-sm text-neutral-700 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Info */}
      <div className="px-4 py-4 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Calendar className="h-4 w-4" />
          <span>Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Products section */}
      {stats.products > 0 && (
        <div className="px-4 py-4 bg-white mt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#111827]">Produits ({stats.products})</h3>
            <Link href={`/recherche?seller=${profileId}`} className="text-sm text-[#2F7D32] font-medium">
              Voir tout
            </Link>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <Package className="h-5 w-5" />
            <span className="text-sm">{stats.products} produits en vente</span>
          </div>
        </div>
      )}
    </div>
  )
}
