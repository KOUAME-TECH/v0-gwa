"use client"

import { useEffect, useState, useCallback, useRef, memo, startTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Heart, MessageCircle, Share2, UserPlus, Search, Bell,
  ShoppingBag, BadgeCheck, MapPin, Bookmark, MoreHorizontal,
  ChevronLeft, ChevronRight, X, Flag, EyeOff, LinkIcon,
  Trash2, UserCheck
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import { GwaMark } from "@/components/brand/gwa-mark"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"
import { StoriesRail, type StoriesSeedProduct } from "@/components/feed/stories-rail"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"
import { feedPriorityForTier } from "@/lib/pricing/entitlements"
import { ClickableListenText, ListenMicButton } from "@/components/media/clickable-listen-text"
import { isLowQualityPostContent } from "@/lib/feed/content-quality"
import { ListenRitualBadge } from "@/components/media/listen-ritual-badge"
import { useListenMode } from "@/hooks/use-listen-mode"
import { useListenRitual } from "@/hooks/use-listen-ritual"
import { useNavBadges } from "@/hooks/use-nav-badges"
import { useDataSaver } from "@/hooks/use-data-saver"
import {
  VOICE_COMMENT_PLACEHOLDER,
} from "@/lib/comments/voice-comment"
import { loadFeedComments } from "@/lib/comments/feed-comments"
import { buildProductListenText } from "@/lib/media/product-listen"
import {
  followButtonLabel,
  shouldShowFollowButton,
} from "@/lib/social/follow"
import {
  FEED_FILTER_CHIPS,
  productMatchesFeedFilter,
} from "@/lib/catalog/feed-filters"
import { saveFeedCache, loadFeedCache, feedCacheAgeLabel } from "@/lib/offline/feed-cache"
import { prefetchProduct } from "@/lib/products/prefetch"

const CommentComposer = dynamic(
  () => import("@/components/comments/comment-composer").then((m) => m.CommentComposer),
  { ssr: false, loading: () => null },
)

const WeatherWidget = dynamic(
  () => import("@/components/weather-widget").then((m) => m.WeatherWidget),
  { ssr: false, loading: () => null },
)

const FEED_PAGE_SIZE = 12

type Product = {
  id: string
  name: string
  description?: string | null
  price: number
  unit: string
  images: string[]
  audio_url?: string | null
  origin_region: string | null
  origin_country: string | null
  product_type: string
  seller_id: string
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  is_organic?: boolean | null
  categories?: { name: string; slug?: string | null } | null
  profiles: {
    id: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    city: string
    subscription_tier?: string | null
  } | null
}

type Post = {
  id: string
  content: string
  media_urls: { url: string; type: string }[] | null
  video_url: string | null
  audio_url: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  author_id: string
  profiles?: {
    id: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    user_type: string
  }
}

type Comment = {
  id: string
  content: string | null
  audio_url?: string | null
  comment_type?: string
  created_at: string
  parent_comment_id?: string | null
  likes_count?: number
  liked_by_me?: boolean
  replies?: Comment[]
  author: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

type FeedItem = 
  | { type: "product"; data: Product; isLiked: boolean; isSaved: boolean }
  | { type: "post"; data: Post; isLiked: boolean; isSaved: boolean }

const categories = FEED_FILTER_CHIPS.map((c) => ({ id: c.id, name: c.name }))

export default function HomePage() {
  const router = useRouter()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const { enabled: listenMode } = useListenMode()
  const { streak: listenStreak } = useListenRitual()
  const { unreadNotifs } = useNavBadges()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [activeCategory, setActiveCategory] = useState("all")
  const [activeTab, setActiveTab] = useState<"tout" | "suivis" | "produits" | "publications">("tout")
  
  // États pour les commentaires
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followPendingId, setFollowPendingId] = useState<string | null>(null)
  
  // États pour le partage
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [shareItem, setShareItem] = useState<FeedItem | null>(null)

  // Suppression d'une publication (post) — propriétaire uniquement
  const [pendingDeletePost, setPendingDeletePost] = useState<Post | null>(null)
  const [deletingPost, setDeletingPost] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasMoreFeed, setHasMoreFeed] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const feedSentinelRef = useRef<HTMLDivElement | null>(null)
  const headerHidden = useHideOnScroll(true)

  const supabase = createClient()

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        router.prefetch("/marketplace")
        router.prefetch("/recherche")
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => window.clearTimeout(t)
  }, [router])

  // Bell badge — shared store (BottomNav owns fetch); keep local mirror for UI
  useEffect(() => {
    setUnreadNotifications(unreadNotifs)
  }, [unreadNotifs])

  const handleConfirmDeletePost = async () => {
    if (!pendingDeletePost) return
    setDeletingPost(true)
    try {
      const res = await fetch(`/api/posts/${pendingDeletePost.id}`, { method: "DELETE" })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Suppression impossible")
      setFeed((prev) =>
        prev.filter((f) => !(f.type === "post" && f.data.id === pendingDeletePost.id)),
      )
      toast.success("Publication supprimée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setDeletingPost(false)
      setPendingDeletePost(null)
    }
  }

  // Charger l'utilisateur et le feed (parallèle : auth + catalogue + offline)
  useEffect(() => {
    const loadData = async () => {
      const offline = typeof navigator !== "undefined" && !navigator.onLine
      const cached = loadFeedCache()

      if (offline && cached?.items?.length) {
        setFeed(cached.items as FeedItem[])
        setOfflineMode(true)
        setHasMoreFeed(false)
        setIsLoading(false)
        setRefreshing(false)
        toast.message(`Feed hors ligne · ${feedCacheAgeLabel(cached.at)}`)
        return
      }

      const productsQuery = supabase
        .from("products")
        .select(`
          id, name, description, price, unit, images, audio_url, origin_region, origin_country, product_type, seller_id,
          likes_count, comments_count, shares_count, created_at, is_organic,
          profiles:seller_id(id, full_name, avatar_url, is_verified, city, subscription_tier),
          categories:category_id(name, slug)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE_SIZE)

      const postsQuery = supabase
        .from("posts")
        .select("id, content, media_urls, video_url, audio_url, likes_count, comments_count, shares_count, created_at, author_id")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE_SIZE)

      try {
        const [
          {
            data: { user: currentUser },
          },
          { data: products },
          { data: rawPosts },
        ] = await Promise.all([supabase.auth.getUser(), productsQuery, postsQuery])

        setUser(currentUser)
        setOfflineMode(false)

        let userLikes: string[] = []
        let userFavorites: string[] = []

        const authorIds = [...new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean))]

        const metaPromise = currentUser
          ? Promise.all([
              supabase.from("post_likes").select("post_id").eq("user_id", currentUser.id).limit(200),
              supabase.from("favorites").select("product_id").eq("user_id", currentUser.id).limit(200),
              supabase.from("profiles").select("user_type").eq("id", currentUser.id).maybeSingle(),
              supabase.from("followers").select("following_id").eq("follower_id", currentUser.id).limit(200),
            ])
          : Promise.resolve(null)

        const authorsPromise =
          authorIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name, avatar_url, is_verified, user_type")
                .in("id", authorIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null; is_verified: boolean | null; user_type: string | null }[] })

        const [metaRes, authorsRes] = await Promise.all([metaPromise, authorsPromise])

        if (metaRes) {
          const [likesRes, favsRes, profileRes, followsRes] = metaRes
          if (profileRes.data) {
            setUserType(profileRes.data.user_type)
          }
          if (followsRes.data) {
            setFollowingIds(new Set(followsRes.data.map((f) => f.following_id)))
          }
          userLikes = likesRes.data?.map((l) => l.post_id) || []
          userFavorites = favsRes.data?.map((f) => f.product_id) || []
        }

        const profileMap = new Map(
          (authorsRes.data || []).map((p) => [p.id, p]),
        )
        const posts = (rawPosts || []).map((post) => ({
          ...post,
          profiles: profileMap.get(post.author_id) || null,
        }))

        const feedItems: FeedItem[] = []
        const rankedProducts = ([...(products || [])] as Product[]).sort((a, b) => {
          const pa = feedPriorityForTier(a.profiles?.subscription_tier)
          const pb = feedPriorityForTier(b.profiles?.subscription_tier)
          if (pb !== pa) return pb - pa
          return Date.parse(b.created_at || "0") - Date.parse(a.created_at || "0")
        })
        const maxLen = Math.max(rankedProducts.length, posts.length)

        for (let i = 0; i < maxLen; i++) {
          if (rankedProducts[i]) {
            feedItems.push({
              type: "product",
              data: rankedProducts[i],
              isLiked: userFavorites.includes(rankedProducts[i].id),
              isSaved: userFavorites.includes(rankedProducts[i].id),
            })
          }
          if (posts[i]) {
            feedItems.push({
              type: "post",
              data: posts[i] as Post,
              isLiked: userLikes.includes(posts[i].id),
              isSaved: false,
            })
          }
        }

        setFeed(feedItems)
        setHasMoreFeed(
          (products?.length || 0) >= FEED_PAGE_SIZE || posts.length >= FEED_PAGE_SIZE,
        )
        if (feedItems.length) {
          saveFeedCache(
            feedItems.map((item) => ({
              type: item.type,
              data: item.data as unknown as Record<string, unknown>,
              isLiked: item.isLiked,
              isSaved: item.isSaved,
            })),
          )
        }
        setIsLoading(false)
        setRefreshing(false)
      } catch (err) {
        console.warn("[feed] load failed", err)
        if (cached?.items?.length) {
          setFeed(cached.items as FeedItem[])
          setOfflineMode(true)
          setHasMoreFeed(false)
          toast.message(`Feed hors ligne · ${feedCacheAgeLabel(cached.at)}`)
        }
        setIsLoading(false)
        setRefreshing(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, refreshKey])

  useEffect(() => {
    const onOnline = () => {
      setOfflineMode(false)
      setRefreshing(true)
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("gwa:online-sync", onOnline as EventListener)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("gwa:online-sync", onOnline as EventListener)
    }
  }, [])

  const loadMoreFeed = async () => {
    if (loadingMore || !hasMoreFeed || offlineMode) return
    setLoadingMore(true)
    try {
      const productItems = feed.filter((f) => f.type === "product")
      const postItems = feed.filter((f) => f.type === "post")
      const oldestProduct = productItems[productItems.length - 1]?.data.created_at
      const oldestPost = postItems[postItems.length - 1]?.data.created_at

      let productsQuery = supabase
        .from("products")
        .select(`
          id, name, description, price, unit, images, audio_url, origin_region, origin_country, product_type, seller_id,
          likes_count, comments_count, shares_count, created_at, is_organic,
          profiles:seller_id(id, full_name, avatar_url, is_verified, city),
          categories:category_id(name, slug)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE_SIZE)
      if (oldestProduct) productsQuery = productsQuery.lt("created_at", oldestProduct)

      let postsQuery = supabase
        .from("posts")
        .select("id, content, media_urls, video_url, audio_url, likes_count, comments_count, shares_count, created_at, author_id")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE_SIZE)
      if (oldestPost) postsQuery = postsQuery.lt("created_at", oldestPost)

      const [{ data: products }, { data: rawPosts }] = await Promise.all([productsQuery, postsQuery])
      const authorIds = [...new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean))]
      const { data: postProfiles } = authorIds.length
        ? await supabase.from("profiles").select("id, full_name, avatar_url, is_verified, user_type").in("id", authorIds)
        : { data: [] as { id: string }[] }
      const profileMap = new Map((postProfiles || []).map((p) => [p.id, p]))
      const posts = (rawPosts || []).map((post) => ({
        ...post,
        profiles: profileMap.get(post.author_id) || null,
      }))

      const more: FeedItem[] = []
      const maxLen = Math.max(products?.length || 0, posts.length)
      for (let i = 0; i < maxLen; i++) {
        if (products?.[i]) {
          more.push({
            type: "product",
            data: products[i] as Product,
            isLiked: false,
            isSaved: false,
          })
        }
        if (posts[i]) {
          more.push({
            type: "post",
            data: posts[i] as Post,
            isLiked: false,
            isSaved: false,
          })
        }
      }
      if (!more.length) {
        setHasMoreFeed(false)
      } else {
        setFeed((prev) => {
          const ids = new Set(prev.map((p) => p.data.id))
          const appended = more.filter((m) => !ids.has(m.data.id))
          const next = [...prev, ...appended]
          saveFeedCache(
            next.map((item) => ({
              type: item.type,
              data: item.data as unknown as Record<string, unknown>,
              isLiked: item.isLiked,
              isSaved: item.isSaved,
            })),
          )
          return next
        })
        setHasMoreFeed(
          (products?.length || 0) >= FEED_PAGE_SIZE || posts.length >= FEED_PAGE_SIZE,
        )
      }
    } catch (err) {
      console.warn("[feed] loadMore", err)
      toast.error("Impossible de charger plus")
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const node = feedSentinelRef.current
    if (!node || offlineMode || !hasMoreFeed) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreFeed()
      },
      { rootMargin: "480px 0px" },
    )
    io.observe(node)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreFeed, offlineMode, loadingMore, feed.length])

  const formatPrice = (price: number) => new Intl.NumberFormat("fr-FR").format(price)
  
  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "à l'instant"
    if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`
    if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`
    if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`
    return new Date(date).toLocaleDateString("fr-FR")
  }

  // Gérer le like
  const handleLike = async (item: FeedItem) => {
    if (!user) {
      toast.error("Connecte-toi pour aimer cette publication")
      return
    }

    const itemId = item.data.id
    const isLiked = item.isLiked
    const table = item.type === "post" ? "post_likes" : "favorites"
    const idField = item.type === "post" ? "post_id" : "product_id"
    const countTable = item.type === "post" ? "posts" : "products"

    // Mise à jour optimiste
    setFeed(prev => prev.map(f => 
      f.data.id === itemId 
        ? { 
            ...f, 
            isLiked: !isLiked,
            data: {
              ...f.data,
              likes_count: isLiked ? f.data.likes_count - 1 : f.data.likes_count + 1
            }
          }
        : f
    ))

    try {
      if (isLiked) {
        await supabase.from(table).delete().eq("user_id", user.id).eq(idField, itemId)
      } else {
        await supabase.from(table).insert({ user_id: user.id, [idField]: itemId })
      }

      // Mettre à jour le compteur en BD
      await supabase
        .from(countTable)
        .update({ likes_count: isLiked ? item.data.likes_count - 1 : item.data.likes_count + 1 })
        .eq("id", itemId)

      toast.success(isLiked ? "J'aime retiré" : "J'aime ajouté")
    } catch (error) {
      // Annuler en cas d'erreur
      setFeed(prev => prev.map(f => 
        f.data.id === itemId ? { ...f, isLiked, data: { ...f.data, likes_count: item.data.likes_count } } : f
      ))
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  // Gérer la sauvegarde (favoris)
  const handleSave = async (item: FeedItem) => {
    if (!user) {
      toast.error("Connecte-toi pour sauvegarder")
      return
    }
    if (item.type !== "product") return

    const isSaved = item.isSaved

    setFeed(prev => prev.map(f => 
      f.data.id === item.data.id ? { ...f, isSaved: !isSaved } : f
    ))

    try {
      if (isSaved) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", item.data.id)
        toast.success("Retiré des favoris")
      } else {
        await supabase.from("favorites").insert({ user_id: user.id, product_id: item.data.id })
        toast.success("Ajouté aux favoris")
      }
    } catch (error) {
      setFeed(prev => prev.map(f => 
        f.data.id === item.data.id ? { ...f, isSaved } : f
      ))
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  // Ouvrir les commentaires
  const openComments = async (item: FeedItem) => {
    setSelectedItem(item)
    setLoadingComments(true)
    setComments([])
    setReplyTo(null)

    try {
      const target =
        item.type === "post"
          ? { type: "post" as const, id: item.data.id }
          : { type: "product" as const, id: item.data.id }

      const loaded = await loadFeedComments(supabase, target, user?.id)
      setComments(loaded)
      // Resync compteur affiché (évite "Commentaires (3)" alors qu'il n'y en a que 2)
      const realCount = loaded.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0)
      setFeed((prev) =>
        prev.map((f) =>
          f.data.id === item.data.id
            ? { ...f, data: { ...f.data, comments_count: realCount } }
            : f,
        ),
      )
      setSelectedItem((prev) =>
        prev && prev.data.id === item.data.id
          ? { ...prev, data: { ...prev.data, comments_count: realCount } }
          : prev,
      )
    } catch (error) {
      console.error("openComments", error)
      toast.error("Impossible de charger les commentaires. Réessayez.")
    } finally {
      setLoadingComments(false)
    }
  }

  const toggleCommentLike = async (commentId: string) => {
    if (!user) {
      toast.error("Connecte-toi pour aimer un commentaire.")
      return
    }
    // Optimiste
    const patch = (list: Comment[]): Comment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.liked_by_me
          return {
            ...c,
            liked_by_me: liked,
            likes_count: Math.max(0, (c.likes_count || 0) + (liked ? 1 : -1)),
          }
        }
        if (c.replies?.length) return { ...c, replies: patch(c.replies) }
        return c
      })
    setComments((prev) => patch(prev))

    try {
      const res = await fetch("/api/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          type: selectedItem?.type === "product" ? "product" : "post",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setComments((prev) => patch(prev)) // revert
        toast.error(data.error || "Impossible d'aimer ce commentaire.")
        return
      }
      const apply = (list: Comment[]): Comment[] =>
        list.map((c) => {
          if (c.id === commentId) {
            return { ...c, liked_by_me: !!data.liked, likes_count: Number(data.likes_count || 0) }
          }
          if (c.replies?.length) return { ...c, replies: apply(c.replies) }
          return c
        })
      setComments((prev) => apply(prev))
    } catch {
      setComments((prev) => patch(prev))
      toast.error("Connexion interrompue. Réessayez.")
    }
  }

  const submitComment = async (voice: { file: File; url: string } | null) => {
    if (!user) {
      toast.error("Connecte-toi pour commenter.")
      return
    }
    const hasText = !!newComment.trim()
    const hasVoice = !!voice?.file?.size
    if ((!hasText && !hasVoice) || !selectedItem) return

    setSubmittingComment(true)

    try {
      const form = new FormData()
      form.append("type", selectedItem.type === "post" ? "post" : "product")
      form.append("id", selectedItem.data.id)
      if (hasText) form.append("text", newComment.trim())
      if (hasVoice && voice) form.append("audio", voice.file)
      if (replyTo && selectedItem) {
        form.append("parentCommentId", replyTo.id)
      }

      const res = await fetch("/api/comments", { method: "POST", body: form })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(payload.error || "Impossible d'envoyer votre message.")
        return
      }

      const { comment: created, voiceStored } = payload as {
        comment: Comment
        voiceStored: boolean
      }

      if (replyTo) {
        const inject = (list: Comment[]): Comment[] =>
          list.map((c) => {
            if (c.id === replyTo.id) {
              return { ...c, replies: [...(c.replies || []), created] }
            }
            if (c.replies?.length) return { ...c, replies: inject(c.replies) }
            return c
          })
        setComments((prev) => inject(prev))
      } else {
        setComments((prev) => [created, ...prev])
        const newCount = selectedItem.data.comments_count + 1
        setFeed((prev) =>
          prev.map((f) =>
            f.data.id === selectedItem.data.id
              ? { ...f, data: { ...f.data, comments_count: newCount } }
              : f,
          ),
        )
        setSelectedItem((prev) =>
          prev ? { ...prev, data: { ...prev.data, comments_count: newCount } } : prev,
        )
      }

      setNewComment("")
      setReplyTo(null)
      toast.success(
        replyTo
          ? "Réponse envoyée"
          : voiceStored
            ? "Votre note vocale est publiée"
            : "Commentaire publié",
      )
    } catch (error) {
      console.error("[comments]", error)
      toast.error("Impossible d'envoyer votre message. Réessayez.")
    } finally {
      setSubmittingComment(false)
    }
  }

  // Gérer le partage
  const openShare = (item: FeedItem) => {
    setShareItem(item)
    setShowShareSheet(true)
  }

  const shareVia = async (platform: string) => {
    if (!shareItem) return

    const url = shareItem.type === "product" 
      ? `${window.location.origin}/produit/${shareItem.data.id}`
      : `${window.location.origin}/post/${shareItem.data.id}`
    
    const text = shareItem.type === "product"
      ? `Découvrez ${(shareItem.data as Product).name} sur GWA`
      : `${(shareItem.data as Post).content?.slice(0, 100)}...`

    try {
      const countTable = shareItem.type === "post" ? "posts" : "products"
      const newCount = shareItem.data.shares_count + 1
      
      await supabase.from(countTable).update({ shares_count: newCount }).eq("id", shareItem.data.id)

      setFeed(prev => prev.map(f => 
        f.data.id === shareItem.data.id 
          ? { ...f, data: { ...f.data, shares_count: newCount } }
          : f
      ))
    } catch (error) {
      console.error("Erreur mise à jour partages:", error)
    }

    switch (platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank")
        break
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank")
        break
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank")
        break
      case "copy":
        await navigator.clipboard.writeText(url)
        toast.success("Lien copié — merci de partager GWA !")
        break
    }

    setShowShareSheet(false)
    setShareItem(null)
    if (platform !== "copy") {
      toast.success("Merci d'avoir partagé !")
    }
  }

  // Suivre un utilisateur
  const handleFollow = async (userId: string) => {
    if (!user) {
      toast.error("Connecte-toi pour suivre cet utilisateur")
      router.push("/auth/login?redirect=/")
      return
    }
    if (userId === user.id) return
    if (followPendingId === userId) return

    const wasFollowing = followingIds.has(userId)
    setFollowPendingId(userId)

    setFollowingIds((prev) => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(userId)
      else next.add(userId)
      return next
    })

    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId)
        if (error) throw error
        toast.success("Abonnement retiré")
      } else {
        const { error } = await supabase.from("followers").insert({
          follower_id: user.id,
          following_id: userId,
        })
        if (error) throw error
        toast.success("Vous suivez maintenant cet utilisateur")
      }
    } catch (error) {
      setFollowingIds((prev) => {
        const next = new Set(prev)
        if (wasFollowing) next.add(userId)
        else next.delete(userId)
        return next
      })
      toast.error("Erreur lors du suivi")
    } finally {
      setFollowPendingId(null)
    }
  }

  // Filtrer le feed
  const filteredFeed = feed.filter(item => {
    // Filtre par onglet
    if (activeTab === "produits" && item.type !== "product") return false
    if (activeTab === "publications" && item.type !== "post") return false
    if (activeTab === "suivis") {
      const authorId =
        item.type === "product"
          ? (item.data as Product).seller_id
          : (item.data as Post).author_id
      if (!authorId || !followingIds.has(authorId)) return false
    }

    // Masquer posts marketing / démo peu utiles
    if (item.type === "post" && isLowQualityPostContent((item.data as Post).content)) {
      return false
    }
    
    // Filtre par catégorie (slug réel, pas product_type)
    if (activeCategory !== "all" && item.type === "product") {
      const product = item.data as Product
      return productMatchesFeedFilter(activeCategory, {
        categorySlug: product.categories?.slug,
        categoryName: product.categories?.name,
        productName: product.name,
      })
    }
    // En filtre catégorie, masquer les posts (pas de catégorie)
    if (activeCategory !== "all" && item.type === "post") return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      {/* Météo — mobile / tablette */}
      {userType && ["farmer", "cooperative"].includes(userType) && (
        <div className="gwa-shell-feed px-4 pt-3 lg:hidden">
          <WeatherWidget />
        </div>
      )}

      {/* Header mobile — disparaît au scroll bas comme bottom nav */}
      <header
        className={cn(
          "sticky top-0 z-40 bg-white border-b border-[#E5E7EB] lg:hidden",
          "transition-transform duration-300 ease-out will-change-transform",
          headerHidden && "-translate-y-full",
        )}
        aria-hidden={headerHidden}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="GWA accueil">
              <GwaMark size={36} showWordmark wordmarkClassName="font-display text-2xl" />
            </Link>
            <div className="flex items-center gap-2">
              <ListenRitualBadge streak={listenStreak} />
              <YellyAideButton source="mobile_feed_header" compact className="text-[#1F5C2E]" />
              <Link
                href="/marketplace?digest=1"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-[#1F5C2E]/8 text-[#1F5C2E] text-xs font-semibold active:scale-95 transition-transform"
                aria-label="Écouter les nouveautés — Harmattan Digest"
                title="Écouter les nouveautés près de chez vous"
              >
                Digest
              </Link>
              <Link href="/recherche">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <Search className="h-5 w-5 text-[#4B5563]" />
                </Button>
              </Link>
              <Link href="/notifications" aria-label="Notifications">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 relative">
                  <Bell className="h-5 w-5 text-[#4B5563]" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 min-w-[8px] h-2 px-0.5 bg-[#F39A1F] rounded-full" />
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Onglets */}
        <div className="flex border-t border-[#E5E7EB]">
          {[
            { key: "tout", label: "Pour vous" },
            { key: "suivis", label: "Suivis" },
            { key: "produits", label: "Produits" },
            { key: "publications", label: "Pubs" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => startTransition(() => setActiveTab(tab.key as typeof activeTab))}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-[#2F7D32] border-b-2 border-[#2F7D32]"
                  : "text-[#4B5563]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Catégories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => startTransition(() => setActiveCategory(cat.id))}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Desktop composition */}
      <div className="gwa-feed-desktop">
        <aside className="hidden lg:block sticky top-20">
          {userType && ["farmer", "cooperative"].includes(userType) && (
            <div className="mb-4">
              <WeatherWidget />
            </div>
          )}
          <p className="font-display text-sm text-[#1F5C2E] mb-3">Catégories</p>
          <div className="flex flex-col gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => startTransition(() => setActiveCategory(cat.id))}
                className={cn(
                  "text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  activeCategory === cat.id
                    ? "bg-[#1F5C2E] text-white"
                    : "text-[#4B5563] hover:bg-white/80",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-1 border-t border-[#1F5C2E]/10 pt-4">
            {[
              { key: "tout", label: "Pour vous" },
              { key: "suivis", label: "Suivis" },
              { key: "produits", label: "Produits" },
              { key: "publications", label: "Publications" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.key as typeof activeTab))}
                className={cn(
                  "text-left px-3 py-2 rounded-xl text-sm font-medium",
                  activeTab === tab.key ? "text-[#1F5C2E] font-semibold" : "text-[#4B5563]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <div
          className="px-3 pt-3 pb-2 space-y-3 lg:px-0 lg:pt-0 lg:pb-0"
        onTouchStart={(e) => {
          if (typeof window !== "undefined" && window.scrollY <= 0) {
            pullStartY.current = e.touches[0]?.clientY ?? null
          } else {
            pullStartY.current = null
          }
        }}
        onTouchMove={(e) => {
          if (pullStartY.current == null || refreshing) return
          const y = e.touches[0]?.clientY ?? pullStartY.current
          const delta = Math.max(0, y - pullStartY.current)
          if (delta > 12) setPullY(Math.min(delta * 0.45, 72))
        }}
        onTouchEnd={() => {
          if (pullY > 56 && !refreshing) {
            setRefreshing(true)
            setRefreshKey((k) => k + 1)
          }
          setPullY(0)
          pullStartY.current = null
        }}
      >
        {(pullY > 8 || refreshing) && (
          <div className="flex justify-center text-xs text-[#2F7D32] py-1">
            {refreshing ? "Actualisation…" : pullY > 56 ? "Relâchez pour actualiser" : "Tirez pour actualiser"}
          </div>
        )}
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="aspect-[4/5] w-full rounded-xl mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))
        ) : filteredFeed.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl shadow-sm">
            <div className="w-20 h-20 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-10 w-10 text-[#2F7D32]" />
            </div>
            {user ? (
              <>
                <h3 className="font-semibold text-lg text-[#111827] mb-2">
                  {activeTab === "suivis"
                    ? followingIds.size === 0
                      ? "Suis des producteurs"
                      : "Rien de nouveau chez tes suivis"
                    : "Aucune publication pour le moment"}
                </h3>
                <p className="text-[#4B5563] text-sm mb-6">
                  {activeTab === "suivis"
                    ? "Appuie sur Suivre sous une publication pour remplir cet onglet."
                    : ["producteur", "cooperative", "transformateur", "entreprise", "farmer", "processor"].includes(userType || "")
                    ? "Publiez votre premier produit pour commencer a vendre"
                    : userType === "entreprise" || userType === "business"
                    ? "Explorez le marketplace pour trouver des fournisseurs"
                    : "Decouvrez les produits des producteurs agricoles africains"
                  }
                </p>
                <div className="flex flex-col gap-3">
                  {["producteur", "cooperative", "transformateur", "entreprise", "farmer", "processor"].includes(userType || "") ? (
                    <Link href="/publier">
                      <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427]">
                        Publier un produit
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/marketplace">
                      <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427]">
                        Explorer le marketplace
                      </Button>
                    </Link>
                  )}
                  {["producteur", "cooperative", "transformateur", "entreprise", "farmer", "processor"].includes(userType || "") && (
                    <Link href="/dashboard">
                      <Button variant="outline" className="w-full rounded-full bg-transparent">
                        Mon tableau de bord
                      </Button>
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg text-[#111827] mb-2">Bienvenue sur GWA</h3>
                <p className="text-[#4B5563] text-sm mb-6">
                  Découvrez et connectez-vous avec des producteurs agricoles africains
                </p>
                <div className="flex flex-col gap-3">
                  <Link href="/auth/signup">
                    <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427]">
                      Créer un compte
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button variant="outline" className="w-full rounded-full bg-transparent">
                      Explorer le marketplace
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <StoriesRail
              className="lg:px-0"
              seedProducts={feed
                .filter((item) => item.type === "product")
                .map((item) => item.data as StoriesSeedProduct)}
            />
            {filteredFeed.map((item, index) => (
            <FeedCard
              key={`${item.type}-${item.data.id}`}
              item={item}
              priority={index < 2}
              onPrefetch={() => {
                if (item.type === "product") {
                  prefetchProduct(router, item.data as Product & Record<string, unknown>)
                } else {
                  try { router.prefetch(`/post/${item.data.id}`) } catch { /* */ }
                }
              }}
              onLike={() => handleLike(item)}
              onComment={() => openComments(item)}
              onShare={() => openShare(item)}
              onSave={() => handleSave(item)}
              onFollow={() => handleFollow(item.type === "product" 
                ? (item.data as Product).seller_id 
                : (item.data as Post).author_id
              )}
              isFollowing={followingIds.has(
                item.type === "product"
                  ? (item.data as Product).seller_id
                  : (item.data as Post).author_id,
              )}
              followPending={followPendingId === (
                item.type === "product"
                  ? (item.data as Product).seller_id
                  : (item.data as Post).author_id
              )}
              authorUserId={
                item.type === "product"
                  ? (item.data as Product).seller_id
                  : (item.data as Post).author_id
              }
              currentUserId={user?.id || null}
              onDelete={
                item.type === "post"
                  ? () => setPendingDeletePost(item.data as Post)
                  : undefined
              }
              formatPrice={formatPrice}
              formatTimeAgo={formatTimeAgo}
              listenModeHighlight={listenMode}
            />
          ))}
          {hasMoreFeed && !offlineMode ? (
            <div className="px-3 pb-4 pt-1">
              <div ref={feedSentinelRef} className="h-1 w-full" aria-hidden />
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-[#1F5C2E]/25 bg-white text-[#1F5C2E]"
                disabled={loadingMore}
                onClick={() => void loadMoreFeed()}
              >
                {loadingMore ? "Chargement…" : "Charger plus"}
              </Button>
            </div>
          ) : null}
          {offlineMode ? (
            <p className="px-4 pb-4 text-center text-xs text-amber-700">
              Mode hors ligne — contenu en cache
            </p>
          ) : null}
          </>
        )}
      </div>

        <aside className="hidden lg:block sticky top-20 space-y-5">
          <div className="rounded-2xl bg-white/90 p-5 ring-1 ring-[#1F5C2E]/10">
            <p className="font-display text-lg text-[#1F5C2E]">Le Digest</p>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
              Les nouveautés près de chez toi, à écouter comme une radio du marché.
            </p>
            <Link
              href="/marketplace?digest=1"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#1F5C2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#184a25]"
            >
              Écouter maintenant
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <Link
              href="/recherche"
              className="block rounded-xl px-1 py-2 font-medium text-[#1F5C2E] underline-offset-4 hover:underline"
            >
              Chercher quelqu’un ou un produit
            </Link>
            <Link
              href="/notifications"
              className="block rounded-xl px-1 py-2 font-medium text-[#4B5563] hover:text-[#111827]"
            >
              {unreadNotifications > 0
                ? `Tes notifs (${unreadNotifications})`
                : "Tes notifications"}
            </Link>
          </div>
        </aside>
      </div>

      {/* Sheet commentaires */}
      <Sheet
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null)
            setNewComment("")
            setReplyTo(null)
          }
        }}
      >
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl flex flex-col p-4 bg-white">
          <SheetHeader className="border-b border-[#E5E7EB] pb-4 shrink-0">
            <SheetTitle className="text-center text-[#111827]">
              Commentaires (
              {comments.reduce(
                (n, c) => n + 1 + (c.replies?.length || 0),
                0,
              ) || selectedItem?.data.comments_count || 0}
              )
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
              {loadingComments ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))
              ) : comments.length === 0 ? (
                <p className="text-center text-[#4B5563] py-8">
                  Soyez le premier à réagir !
                </p>
              ) : (
                comments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    formatTimeAgo={formatTimeAgo}
                    listenMode={listenMode}
                    canReply={!!selectedItem}
                    currentUserId={user?.id || null}
                    targetType={selectedItem?.type === "product" ? "product" : "post"}
                    onLike={toggleCommentLike}
                    onReply={(c) => setReplyTo(c)}
                    onDeleted={(id) =>
                      setComments((prev) => prev.filter((c) => c.id !== id))
                    }
                    onUpdated={(updated) =>
                      setComments((prev) =>
                        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                      )
                    }
                  />
                ))
              )}
          </div>

          <div className="shrink-0 pb-safe-bottom space-y-2">
            {replyTo && (
              <div className="flex items-center justify-between rounded-xl bg-[#FFF6E5] px-3 py-2 text-xs text-[#4B5563]">
                <span className="truncate">
                  Réponse à <strong>{replyTo.author?.full_name || "ce commentaire"}</strong>
                </span>
                <button type="button" className="text-[#2F7D32] font-medium" onClick={() => setReplyTo(null)}>
                  Annuler
                </button>
              </div>
            )}
            <CommentComposer
              userInitial={user?.email?.charAt(0)?.toUpperCase() || "?"}
              value={newComment}
              onChange={setNewComment}
              onSubmit={submitComment}
              submitting={submittingComment}
              loggedIn={!!user}
              onAuthRequired={() => {
                toast.error("Connecte-toi pour commenter.")
                router.push("/auth/login?redirect=/")
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet partage */}
      <Sheet open={showShareSheet} onOpenChange={setShowShareSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center text-[#111827]">Partager</SheetTitle>
          </SheetHeader>
          
          <div className="grid grid-cols-4 gap-4 py-4">
            <button onClick={() => shareVia("whatsapp")} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-[#25D366] flex items-center justify-center">
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <span className="text-xs text-[#4B5563]">WhatsApp</span>
            </button>

            <button onClick={() => shareVia("facebook")} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-[#1877F2] flex items-center justify-center">
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <span className="text-xs text-[#4B5563]">Facebook</span>
            </button>

            <button onClick={() => shareVia("twitter")} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-black flex items-center justify-center">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-xs text-[#4B5563]">X</span>
            </button>

            <button onClick={() => shareVia("copy")} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-[#6B7280] flex items-center justify-center">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </div>
              <span className="text-xs text-[#4B5563]">Copier</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation suppression publication */}
      <AlertDialog
        open={!!pendingDeletePost}
        onOpenChange={(open) => !open && setPendingDeletePost(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette publication ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre publication sera définitivement retirée du fil. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPost}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeletePost()
              }}
              disabled={deletingPost}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingPost ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Composant FeedCard
const FeedCard = memo(function FeedCard({ 
  item, 
  onLike, 
  onComment, 
  onShare, 
  onSave,
  onFollow,
  currentUserId,
  authorUserId,
  isFollowing,
  followPending,
  onDelete,
  formatPrice,
  formatTimeAgo,
  listenModeHighlight,
  priority = false,
  onPrefetch,
}: { 
  item: FeedItem
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onSave: () => void
  onFollow: () => void
  currentUserId?: string | null
  authorUserId: string
  isFollowing: boolean
  followPending?: boolean
  onDelete?: () => void
  formatPrice: (price: number) => string
  formatTimeAgo: (date: string) => string
  listenModeHighlight?: boolean
  priority?: boolean
  onPrefetch?: () => void
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const lastTapRef = useRef(0)
  const touchStartX = useRef<number | null>(null)
  const { imageQuality, allowAutoplay } = useDataSaver()
  
  const isProduct = item.type === "product"
  const data = item.data
  const profile = data.profiles
  const isOwnPost =
    !isProduct && !!currentUserId && (data as Post).author_id === currentUserId
  const postAudioUrl = !isProduct ? (data as Post).audio_url : null
  
  // Normalize medias: products have string[], posts have {url,type}[]
  const rawMedias = isProduct ? (data as Product).images : (data as Post).media_urls
  const medias: { url: string; type: string }[] | null = rawMedias
    ? rawMedias.map((m: string | { url: string; type: string }) =>
        typeof m === "string" ? { url: m, type: "image" } : m
      )
    : null
  const images = medias?.filter(m => m.type === "image" || !m.type.startsWith("video")).map(m => m.url) || null
  const videos = medias?.filter(m => m.type?.startsWith("video")) || []
  const hasVideo = videos.length > 0
  const productName = isProduct ? (data as Product).name : ""
  const hasMultipleImages = medias && medias.length > 1

  return (
    <article className="bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/[0.04]" onMouseEnter={() => onPrefetch?.()} onFocusCapture={() => onPrefetch?.()} onTouchStart={() => onPrefetch?.()}>
      {/* Header auteur — actions secondaires dans le menu */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <Link 
          href={isProduct ? `/profil/${(data as Product).seller_id}` : `/profil/${(data as Post).author_id}`} 
          className="flex items-center gap-2.5 min-w-0"
        >
          <Avatar className="h-10 w-10 ring-2 ring-[#FFF6E5]">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className={cn(
              "text-white text-sm",
              isProduct ? "bg-[#2F7D32]" : "bg-[#F39A1F]"
            )}>
              {profile?.full_name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#111827] text-sm truncate">
                {profile?.full_name || "Utilisateur"}
              </span>
              {shouldShowVerifiedBadge(profile) && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E8F0E9] px-1.5 py-0.5 text-[10px] font-semibold text-[#1F5C2E]">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  Vérifié
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B7280] flex items-center gap-1 truncate">
              {isProduct ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {(data as Product).origin_region || (data as Product).origin_country || ("city" in (profile || {}) ? (profile as { city?: string }).city : null) || "Afrique"}
                </>
              ) : (
                <>{formatTimeAgo(data.created_at)}</>
              )}
            </p>
          </div>
        </Link>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0">
              <MoreHorizontal className="h-5 w-5 text-[#4B5563]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {shouldShowFollowButton(currentUserId, authorUserId) && (
              <DropdownMenuItem onClick={onFollow} disabled={followPending}>
                {isFollowing ? (
                  <UserCheck className="h-4 w-4 mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {followButtonLabel(isFollowing)}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </DropdownMenuItem>
            {isProduct && (
              <DropdownMenuItem onClick={onSave}>
                <Bookmark className="h-4 w-4 mr-2" />
                {item.isSaved ? "Retirer des favoris" : "Enregistrer"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => {
              const url = `${window.location.origin}/${isProduct ? "produit" : "post"}/${data.id}`
              navigator.clipboard.writeText(url)
              toast.success("Lien copié")
            }}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Copier le lien
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                try {
                  const key = `gwa_hide_${item.type}_${data.id}`
                  localStorage.setItem(key, "1")
                  toast.success("Publication masquée sur cet appareil")
                  window.dispatchEvent(new CustomEvent("gwa:feed-hide", { detail: { id: data.id } }))
                } catch {
                  toast.success("Publication masquée")
                }
              }}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Masquer
            </DropdownMenuItem>
            {isOwnPost && onDelete ? (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  void (async () => {
                    if (!currentUserId) {
                      toast.error("Connecte-toi pour signaler")
                      return
                    }
                    const reason =
                      window.prompt(
                        "Pourquoi signales-tu ce contenu ? (spam, arnaque, inapproprié…)",
                      ) || ""
                    if (reason.trim().length < 3) {
                      toast.error("Motif trop court")
                      return
                    }
                    const res = await fetch("/api/reports", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        reported_type: isProduct ? "product" : "post",
                        reported_id: data.id,
                        reason: reason.trim(),
                      }),
                    })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}))
                      toast.error(err.error || "Signalement impossible")
                      return
                    }
                    toast.success("Signalement envoyé à la modération")
                  })()
                }}
                className="text-destructive"
              >
                <Flag className="h-4 w-4 mr-2" />
                Signaler
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Texte post */}
      {!isProduct && ((data as Post).content || postAudioUrl) && (
        <div className="px-3.5 pb-2.5">
          <ClickableListenText
            text={(data as Post).content}
            audioUrl={postAudioUrl}
            fallbackLabel={VOICE_COMMENT_PLACEHOLDER}
            highlight={listenModeHighlight}
            autoListen={listenModeHighlight}
          />
        </div>
      )}

      {/* Videos */}
      {hasVideo && (
        <div className="relative mx-2 mb-1 rounded-xl overflow-hidden bg-black">
          <div className="relative aspect-video">
            <video
              src={videos[0].url}
              controls
              playsInline
              preload={allowAutoplay ? "metadata" : "none"}
              poster={images?.[0] || undefined}
              className="w-full h-full object-contain"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
            />
          </div>
        </div>
      )}

      {/* Images — format agréable 4:5, double-tap like, swipe */}
      {!hasVideo && medias && medias.length > 0 && (
        <div className="relative mx-2 mb-1">
          <button
            type="button"
            className="relative aspect-[4/5] lg:aspect-[5/4] max-h-[70vh] lg:max-h-[420px] bg-gradient-to-b from-[#E8F0E9] to-[#E8E4DC] overflow-hidden w-full block rounded-xl active:opacity-95"
            onClick={() => {
              const now = Date.now()
              if (now - lastTapRef.current < 280) {
                lastTapRef.current = 0
                onLike()
                return
              }
              lastTapRef.current = now
              window.setTimeout(() => {
                if (lastTapRef.current === now) setLightboxOpen(true)
              }, 290)
            }}
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              if (!hasMultipleImages || touchStartX.current == null) return
              const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
              const delta = endX - touchStartX.current
              touchStartX.current = null
              if (Math.abs(delta) < 50) return
              if (delta < 0) {
                setCurrentImageIndex((prev) =>
                  prev < medias.length - 1 ? prev + 1 : 0,
                )
              } else {
                setCurrentImageIndex((prev) =>
                  prev > 0 ? prev - 1 : medias.length - 1,
                )
              }
            }}
            aria-label="Agrandir l'image"
          >
            <Image
              src={medias[currentImageIndex]?.url || "/placeholder.svg"}
              alt={isProduct ? (data as Product).name : "Publication"}
              fill
              {...(priority
                ? { priority: true, fetchPriority: "high" as const }
                : { loading: "lazy" as const })}
              quality={imageQuality}
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
            />
          </button>

          {hasMultipleImages && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex(prev => prev > 0 ? prev - 1 : medias.length - 1)
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white"
                aria-label="Image précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex(prev => prev < medias.length - 1 ? prev + 1 : 0)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white"
                aria-label="Image suivante"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/25 backdrop-blur-sm">
                {medias.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === currentImageIndex ? "bg-white w-4" : "bg-white/50 w-1.5"
                    )}
                  />
                ))}
              </div>
            </>
          )}

          {isProduct && (
            <div className="absolute top-3 left-3 bg-[#2F7D32]/95 backdrop-blur-sm text-white pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
              <ShoppingBag className="h-3 w-3 shrink-0" />
              <span>Produit</span>
              <ListenMicButton
                size="xs"
                text={buildProductListenText(data as Product)}
                audioUrl={(data as Product).audio_url}
                fallbackLabel={(data as Product).name}
                highlight={listenModeHighlight}
                className="!bg-white/20 !text-white hover:!bg-white/30 ring-0"
              />
            </div>
          )}
        </div>
      )}

      {lightboxOpen && medias?.[currentImageIndex]?.url && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Image en plein écran"
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex-1 relative w-full"
            onClick={() => setLightboxOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={medias[currentImageIndex].url}
              alt={isProduct ? (data as Product).name : "Publication"}
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-4"
            />
          </button>
          {hasMultipleImages && (
            <div className="flex items-center justify-center gap-6 pb-8 safe-bottom">
              <button
                type="button"
                className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
                onClick={() =>
                  setCurrentImageIndex((prev) =>
                    prev > 0 ? prev - 1 : medias.length - 1,
                  )
                }
                aria-label="Précédente"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <span className="text-white/80 text-sm tabular-nums">
                {currentImageIndex + 1} / {medias.length}
              </span>
              <button
                type="button"
                className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
                onClick={() =>
                  setCurrentImageIndex((prev) =>
                    prev < medias.length - 1 ? prev + 1 : 0,
                  )
                }
                aria-label="Suivante"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info produit */}
      {isProduct && (
        <div className="px-3.5 pt-3">
          <Link href={`/produit/${data.id}`} className="block">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-[#111827] text-[15px] leading-snug line-clamp-2">
                {(data as Product).name}
              </h3>
              <p className="text-base font-bold text-red-600 tabular-nums shrink-0">
                {formatPrice((data as Product).price)}
                <span className="text-[10px] font-medium text-[#6B7280] ml-0.5">
                  /{(data as Product).unit}
                </span>
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Actions prioritaires : like + comment + partager (+ acheter pour produit) */}
      <div className="flex items-center gap-1 px-2.5 py-2.5">
        <button
          type="button"
          onClick={onLike}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-full active:bg-[#FFF6E5] transition-colors"
          aria-label="J'aime"
        >
          <Heart className={cn(
            "h-6 w-6 transition-colors",
            item.isLiked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]"
          )} />
          {(data.likes_count || 0) > 0 && (
            <span className={cn(
              "text-sm font-medium tabular-nums",
              item.isLiked ? "text-[#F39A1F]" : "text-[#4B5563]"
            )}>
              {data.likes_count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onComment}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[#4B5563] active:bg-[#FFF6E5] transition-colors"
          aria-label="Commenter"
        >
          <MessageCircle className="h-6 w-6" />
          {(data.comments_count || 0) > 0 && (
            <span className="text-sm font-medium tabular-nums">{data.comments_count}</span>
          )}
        </button>

        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[#4B5563] active:bg-[#FFF6E5] transition-colors"
          aria-label="Partager"
        >
          <Share2 className="h-6 w-6" />
        </button>

        {isProduct && (
          <Link href={`/produit/${data.id}`} className="ml-auto pr-1">
            <Button
              size="sm"
              className="rounded-full h-9 px-5 bg-[#2F7D32] hover:bg-[#256427] text-white font-semibold shadow-sm"
            >
              Acheter
            </Button>
          </Link>
        )}
      </div>
    </article>
  )
})

function CommentThread({
  comment,
  formatTimeAgo,
  listenMode,
  canReply,
  currentUserId,
  targetType,
  onLike,
  onReply,
  onDeleted,
  onUpdated,
  depth = 0,
}: {
  comment: Comment
  formatTimeAgo: (date: string) => string
  listenMode: boolean
  canReply: boolean
  currentUserId: string | null
  targetType: "post" | "product"
  onLike: (id: string) => void
  onReply: (c: Comment) => void
  onDeleted: (id: string) => void
  onUpdated: (c: Comment) => void
  depth?: number
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.content || "")
  const [busy, setBusy] = useState(false)
  const isMine = !!currentUserId && comment.author?.id === currentUserId

  const saveEdit = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id, text: editText, type: targetType }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Modification impossible")
        return
      }
      onUpdated({ ...comment, content: data.comment?.content || editText })
      setEditing(false)
      toast.success("C’est modifié")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm("Supprimer ce commentaire ?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/comments?id=${comment.id}&type=${targetType}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Suppression impossible")
        return
      }
      onDeleted(comment.id)
      toast.success("Commentaire retiré")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-3", depth > 0 && "ml-8")}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author?.avatar_url || ""} />
          <AvatarFallback className="bg-[#2F7D32] text-white text-xs">
            {comment.author?.full_name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-[#F9FAFB] rounded-2xl px-3 py-2 border border-[#E5E7EB]/60">
            <p className="font-medium text-sm text-[#111827] mb-1.5">
              {comment.author?.full_name || "Membre GWA"}
            </p>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white p-2 text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveEdit()}
                    className="text-xs font-semibold text-[#1F5C2E]"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="text-xs text-[#6B7280]"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <ClickableListenText
                text={comment.content}
                audioUrl={comment.audio_url}
                fallbackLabel={VOICE_COMMENT_PLACEHOLDER}
                textClassName="text-sm"
                highlight={listenMode}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-[#9CA3AF]">
            <span>{formatTimeAgo(comment.created_at)}</span>
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                comment.liked_by_me ? "text-[#F39A1F]" : "text-[#4B5563]",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", comment.liked_by_me && "fill-current")} />
              {(comment.likes_count || 0) > 0 ? comment.likes_count : "J'aime"}
            </button>
            {canReply && depth < 2 && (
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="font-medium text-[#4B5563]"
              >
                Répondre
              </button>
            )}
            {isMine && !editing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditText(comment.content || "")
                    setEditing(true)
                  }}
                  className="font-medium text-[#4B5563]"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="font-medium text-red-600"
                >
                  Supprimer
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {(comment.replies || []).map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          formatTimeAgo={formatTimeAgo}
          listenMode={listenMode}
          canReply={canReply}
          currentUserId={currentUserId}
          targetType={targetType}
          onLike={onLike}
          onReply={onReply}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

