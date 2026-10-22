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
  ArrowLeft,
  MapPin,
  MessageCircle,
  UserPlus,
  UserCheck,
  BadgeCheck,
  Package,
  Star,
  Calendar,
  Loader2,
  Grid3X3,
  LayoutList,
} from "lucide-react"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"
import { toast } from "sonner"

type Profile = {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  user_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
  rating?: number | null
  total_reviews?: number | null
  created_at: string
}

type ProductCard = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  is_organic?: boolean
}

type PostMedia = string | { url?: string; type?: string }

type PostCard = {
  id: string
  content: string | null
  media_urls: PostMedia[] | null
  created_at: string
  likes_count?: number | null
}

function firstPostImage(medias: PostMedia[] | null | undefined): string | null {
  const first = medias?.[0]
  if (!first) return null
  if (typeof first === "string") return first
  return first.url || null
}

type Tab = "produits" | "publications" | "apropos"

const userTypeLabels: Record<string, string> = {
  farmer: "Agriculteur",
  producteur: "Producteur",
  buyer: "Acheteur",
  acheteur: "Acheteur",
  cooperative: "Coopérative",
  business: "Entreprise",
  entreprise: "Entreprise",
  transformateur: "Transformateur",
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
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    products: 0,
    posts: 0,
  })
  const [products, setProducts] = useState<ProductCard[]>([])
  const [posts, setPosts] = useState<PostCard[]>([])
  const [tab, setTab] = useState<Tab>("produits")

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUser(user?.id || null)

      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, bio, user_type, city, country, is_verified, rating, total_reviews, created_at",
        )
        .eq("id", profileId)
        .single()

      if (!p) {
        router.replace("/")
        return
      }
      setProfile(p as Profile)

      const [followersRes, followingRes, productsRes, postsCountRes, productsList, postsList] =
        await Promise.all([
          supabase
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("following_id", profileId),
          supabase
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", profileId),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", profileId)
            .eq("status", "active"),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("author_id", profileId),
          supabase
            .from("products")
            .select("id, name, price, unit, images, is_organic")
            .eq("seller_id", profileId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(24),
          supabase
            .from("posts")
            .select("id, content, media_urls, created_at, likes_count")
            .eq("author_id", profileId)
            .order("created_at", { ascending: false })
            .limit(24),
        ])

      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        products: productsRes.count || 0,
        posts: postsCountRes.count || 0,
      })
      setProducts((productsList.data as ProductCard[]) || [])
      const rawPosts = (postsList.data || []) as PostCard[]
      setPosts(
        rawPosts.map((p) => ({
          ...p,
          media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
        })),
      )
      if (!(productsList.data?.length) && rawPosts.length > 0) {
        setTab("publications")
      }

      if (user) {
        const { data: f } = await supabase
          .from("followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profileId)
          .maybeSingle()
        setIsFollowing(!!f)
      }

      setLoading(false)
    }
    void load()
     
  }, [profileId])

  async function toggleFollow() {
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    setFollowLoading(true)
    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", currentUser)
        .eq("following_id", profileId)
      setIsFollowing(false)
      setStats((p) => ({ ...p, followers: Math.max(0, p.followers - 1) }))
    } else {
      const { error } = await supabase
        .from("followers")
        .insert({ follower_id: currentUser, following_id: profileId })
      if (error) toast.error("Impossible de suivre")
      else {
        setIsFollowing(true)
        setStats((p) => ({ ...p, followers: p.followers + 1 }))
      }
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
  const verified = shouldShowVerifiedBadge(profile)
  const coverSrc = profile.avatar_url || null
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      {/* Cover — style Facebook/LinkedIn */}
      <div className="relative">
        <div className="h-40 sm:h-52 w-full overflow-hidden bg-gradient-to-br from-[#1F5C2E] via-[#2F7D32] to-[#F39A1F]">
          {coverSrc && (
             
            <img
              src={coverSrc}
              alt=""
              className="w-full h-full object-cover opacity-40 scale-110 blur-[2px]"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center backdrop-blur-sm"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="px-4 -mt-14 relative z-10">
          <div className="flex items-end gap-3">
            <Avatar className="h-28 w-28 border-4 border-white shadow-md ring-1 ring-black/5">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-[#2F7D32] text-white text-3xl">
                {profile.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold text-[#111827] truncate">
                  {profile.full_name}
                </h1>
                {verified && <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
              </div>
              {profile.user_type && (
                <Badge className="mt-1 bg-[#FFF6E5] text-[#1F5C2E] border-0 hover:bg-[#FFF6E5]">
                  {userTypeLabels[profile.user_type] || profile.user_type}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-1 bg-white pb-3 border-b border-[#E5E7EB]">
        {(profile.city || profile.country) && (
          <p className="text-sm text-[#4B5563] flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {[profile.city, profile.country].filter(Boolean).join(", ")}
          </p>
        )}
        {(profile.rating != null || (profile.total_reviews || 0) > 0) && (
          <p className="text-sm text-[#4B5563] flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-[#F39A1F] fill-[#F39A1F]" />
            {Number(profile.rating || 0).toFixed(1)}
            {(profile.total_reviews || 0) > 0 && (
              <span className="text-[#9CA3AF]">
                ({profile.total_reviews} avis)
              </span>
            )}
          </p>
        )}
        {profile.bio && (
          <p className="text-sm text-[#374151] leading-relaxed pt-1">{profile.bio}</p>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="grid grid-cols-4 py-3">
          {[
            { label: "Abonnés", value: stats.followers },
            { label: "Abonnements", value: stats.following },
            { label: "Produits", value: stats.products },
            { label: "Posts", value: stats.posts },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-[#111827]">{s.value}</p>
              <p className="text-[10px] text-[#6B7280]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-[#E5E7EB]">
        {isOwnProfile ? (
          <Link href="/profil/edit" className="flex-1">
            <Button className="w-full rounded-full h-11 bg-[#2F7D32] hover:bg-[#256025]">
              Modifier le profil
            </Button>
          </Link>
        ) : (
          <>
            <Button
              onClick={() => void toggleFollow()}
              disabled={followLoading}
              className={`flex-1 rounded-full h-11 font-semibold ${
                isFollowing
                  ? "bg-neutral-100 text-[#111827] hover:bg-neutral-200 border border-neutral-300"
                  : "bg-[#F39A1F] hover:bg-[#D4860D] text-white"
              }`}
            >
              {followLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Abonné
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Suivre
                </>
              )}
            </Button>
            <Link href={`/messages?to=${profileId}`} className="flex-1">
              <Button
                variant="outline"
                className="w-full rounded-full h-11 font-semibold bg-transparent border-[#2F7D32] text-[#2F7D32]"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Message
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        {(
          [
            { id: "produits" as Tab, label: "Produits", icon: Package },
            { id: "publications" as Tab, label: "Publications", icon: Grid3X3 },
            { id: "apropos" as Tab, label: "À propos", icon: LayoutList },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#2F7D32] text-[#2F7D32]"
                : "border-transparent text-[#6B7280]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "produits" && (
        <div className="p-3">
          {products.length === 0 ? (
            <p className="text-center text-sm text-[#6B7280] py-12">Aucun produit en vente</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/produit/${p.id}`}
                  className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] active:scale-[0.99]"
                >
                  <div className="relative aspect-square bg-muted">
                    {p.images?.[0] ? (
                      <Image
                        src={p.images[0]}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="50vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-[#111827] truncate">{p.name}</p>
                    <p className="text-sm font-bold text-red-600 mt-0.5">
                      {fmt(p.price)}{" "}
                      <span className="text-[10px] font-normal text-gray-500">
                        FCFA/{p.unit}
                      </span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "publications" && (
        <div className="p-3 space-y-3">
          {posts.length === 0 ? (
            <p className="text-center text-sm text-[#6B7280] py-12">Aucune publication</p>
          ) : (
            posts.map((post) => {
              const img = firstPostImage(post.media_urls)
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="block bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden active:opacity-90"
                >
                  {img && (
                    <div className="relative aspect-[16/10] bg-muted">
                      <Image src={img} alt="" fill className="object-cover" sizes="100vw" />
                    </div>
                  )}
                  <div className="p-3">
                    {post.content && (
                      <p className="text-sm text-[#111827] line-clamp-3">{post.content}</p>
                    )}
                    <p className="text-[11px] text-[#9CA3AF] mt-2">
                      {new Date(post.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {(post.likes_count || 0) > 0 && ` · ${post.likes_count} j’aime`}
                    </p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {tab === "apropos" && (
        <div className="p-4 space-y-3">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-[#4B5563]">
              <Calendar className="h-4 w-4" />
              <span>
                Membre depuis{" "}
                {new Date(profile.created_at).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            {profile.user_type && (
              <p className="text-sm text-[#4B5563]">
                Type :{" "}
                <span className="font-medium text-[#111827]">
                  {userTypeLabels[profile.user_type] || profile.user_type}
                </span>
              </p>
            )}
            {(profile.city || profile.country) && (
              <p className="text-sm text-[#4B5563]">
                Localisation :{" "}
                <span className="font-medium text-[#111827]">
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
            {profile.bio && (
              <div>
                <p className="text-xs font-semibold text-[#6B7280] uppercase mb-1">Bio</p>
                <p className="text-sm text-[#111827] leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
