"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Heart, MessageCircle, Share2, UserPlus, Search, Bell,
  ShoppingBag, BadgeCheck, MapPin, Bookmark, MoreHorizontal,
  Send, ChevronLeft, ChevronRight, X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Product = {
  id: string
  name: string
  price: number
  unit: string
  images: string[] | null
  location: string | null
  origin_region: string | null
  product_type: string
  seller_id: string
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  profiles?: {
    id: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    city: string | null
  }
}

type Post = {
  id: string
  content: string
  media_urls: string[] | null
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
  content: string
  created_at: string
  author: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

type FeedItem = 
  | { type: "product"; data: Product; isLiked: boolean; isSaved: boolean }
  | { type: "post"; data: Post; isLiked: boolean; isSaved: boolean }

const categories = [
  { id: "all", name: "Tout", icon: "🌍" },
  { id: "cereales", name: "Céréales", icon: "🌾" },
  { id: "cacao", name: "Cacao", icon: "🍫" },
  { id: "cafe", name: "Café", icon: "☕" },
  { id: "fruits", name: "Fruits", icon: "🥭" },
  { id: "legumes", name: "Légumes", icon: "🥬" },
  { id: "artisanat", name: "Artisanat", icon: "🎨" },
]

export default function HomePage() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [activeTab, setActiveTab] = useState<"tout" | "produits" | "publications">("tout")
  
  // États pour les commentaires
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  
  // États pour le partage
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [shareItem, setShareItem] = useState<FeedItem | null>(null)
  
  const supabase = createClient()

  // Charger l'utilisateur et le feed
  useEffect(() => {
    const loadData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Charger les likes et favoris de l'utilisateur
      let userLikes: string[] = []
      let userFavorites: string[] = []
      
      if (currentUser) {
        const [likesRes, favsRes] = await Promise.all([
          supabase.from("post_likes").select("post_id").eq("user_id", currentUser.id),
          supabase.from("favorites").select("product_id").eq("user_id", currentUser.id)
        ])
        userLikes = likesRes.data?.map(l => l.post_id) || []
        userFavorites = favsRes.data?.map(f => f.product_id) || []
      }

      // Charger produits
      const { data: products } = await supabase
        .from("products")
        .select(`
          id, name, price, unit, images, location, origin_region, product_type, seller_id,
          likes_count, comments_count, shares_count, created_at,
          profiles:seller_id(id, full_name, avatar_url, is_verified, city)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(15)

      // Charger posts
      const { data: posts } = await supabase
        .from("posts")
        .select(`
          id, content, media_urls, likes_count, comments_count, shares_count, created_at, author_id,
          profiles:author_id(id, full_name, avatar_url, is_verified, user_type)
        `)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(15)

      // Mélanger produits et posts dans le feed
      const feedItems: FeedItem[] = []
      const maxLen = Math.max(products?.length || 0, posts?.length || 0)
      
      for (let i = 0; i < maxLen; i++) {
        if (products?.[i]) {
          feedItems.push({ 
            type: "product", 
            data: products[i] as Product,
            isLiked: userFavorites.includes(products[i].id),
            isSaved: userFavorites.includes(products[i].id)
          })
        }
        if (posts?.[i]) {
          feedItems.push({ 
            type: "post", 
            data: posts[i] as Post,
            isLiked: userLikes.includes(posts[i].id),
            isSaved: false
          })
        }
      }

      setFeed(feedItems)
      setIsLoading(false)
    }
    loadData()
  }, [supabase])

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
      toast.error("Connectez-vous pour aimer cette publication")
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
      toast.error("Connectez-vous pour sauvegarder")
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

    try {
      const table = item.type === "post" ? "post_comments" : "reviews"
      const idField = item.type === "post" ? "post_id" : "product_id"

      const { data, error } = await supabase
        .from(table)
        .select(`
          id, content, created_at,
          profiles:author_id(id, full_name, avatar_url)
        `)
        .eq(idField, item.data.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      setComments((data || []).map(c => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: c.profiles as any
      })))
    } catch (error) {
      toast.error("Erreur lors du chargement des commentaires")
    } finally {
      setLoadingComments(false)
    }
  }

  // Envoyer un commentaire
  const submitComment = async () => {
    if (!user) {
      toast.error("Connectez-vous pour commenter")
      return
    }
    if (!newComment.trim() || !selectedItem) return

    setSubmittingComment(true)

    try {
      const table = selectedItem.type === "post" ? "post_comments" : "reviews"
      const idField = selectedItem.type === "post" ? "post_id" : "product_id"
      const countTable = selectedItem.type === "post" ? "posts" : "products"

      const { data, error } = await supabase
        .from(table)
        .insert({
          [idField]: selectedItem.data.id,
          author_id: user.id,
          content: newComment.trim()
        })
        .select(`id, content, created_at, profiles:author_id(id, full_name, avatar_url)`)
        .single()

      if (error) throw error

      // Ajouter le commentaire
      setComments(prev => [{
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        author: data.profiles as any
      }, ...prev])

      // Mettre à jour le compteur
      const newCount = selectedItem.data.comments_count + 1
      setFeed(prev => prev.map(f => 
        f.data.id === selectedItem.data.id 
          ? { ...f, data: { ...f.data, comments_count: newCount } }
          : f
      ))

      await supabase.from(countTable).update({ comments_count: newCount }).eq("id", selectedItem.data.id)

      setNewComment("")
      toast.success("Commentaire publié")
    } catch (error) {
      toast.error("Erreur lors de l'envoi du commentaire")
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

    // Mettre à jour le compteur de partages
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
        toast.success("Lien copié dans le presse-papiers")
        break
    }

    setShowShareSheet(false)
    setShareItem(null)
  }

  // Suivre un utilisateur
  const handleFollow = async (userId: string) => {
    if (!user) {
      toast.error("Connectez-vous pour suivre cet utilisateur")
      return
    }

    try {
      await supabase.from("followers").insert({
        follower_id: user.id,
        following_id: userId
      })
      toast.success("Vous suivez maintenant cet utilisateur")
    } catch (error) {
      toast.error("Erreur lors du suivi")
    }
  }

  // Filtrer le feed
  const filteredFeed = feed.filter(item => {
    if (activeTab === "tout") return true
    if (activeTab === "produits") return item.type === "product"
    if (activeTab === "publications") return item.type === "post"
    return true
  })

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#2F7D32]">GWA</h1>
            <div className="flex items-center gap-2">
              <Link href="/recherche">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <Search className="h-5 w-5 text-[#4B5563]" />
                </Button>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 relative">
                  <Bell className="h-5 w-5 text-[#4B5563]" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#F39A1F] rounded-full" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Onglets */}
        <div className="flex border-t border-[#E5E7EB]">
          {[
            { key: "tout", label: "Tout" },
            { key: "produits", label: "Produits" },
            { key: "publications", label: "Publications" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
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
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-[#2F7D32] text-white"
                  : "bg-white text-[#4B5563] border border-[#E5E7EB]"
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <div className="divide-y divide-[#E5E7EB]">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-4">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="aspect-square w-full rounded-xl mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))
        ) : filteredFeed.length === 0 ? (
          <div className="bg-white p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[#2F7D32]/10 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-10 w-10 text-[#2F7D32]" />
            </div>
            <h3 className="font-semibold text-lg text-[#111827] mb-2">Bienvenue sur GWA</h3>
            <p className="text-[#4B5563] text-sm mb-6">
              Découvrez et connectez-vous avec des producteurs et artisans africains
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
          </div>
        ) : (
          filteredFeed.map((item, index) => (
            <FeedCard
              key={`${item.type}-${item.data.id}`}
              item={item}
              onLike={() => handleLike(item)}
              onComment={() => openComments(item)}
              onShare={() => openShare(item)}
              onSave={() => handleSave(item)}
              onFollow={() => handleFollow(item.type === "product" 
                ? (item.data as Product).seller_id 
                : (item.data as Post).author_id
              )}
              formatPrice={formatPrice}
              formatTimeAgo={formatTimeAgo}
            />
          ))
        )}
      </div>

      {/* Sheet commentaires */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
          <SheetHeader className="border-b border-[#E5E7EB] pb-4">
            <SheetTitle className="text-center text-[#111827]">
              Commentaires ({selectedItem?.data.comments_count || 0})
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-[calc(100%-120px)]">
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
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
                  Aucun commentaire pour le moment. Soyez le premier à commenter !
                </p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author?.avatar_url || ""} />
                      <AvatarFallback className="bg-[#2F7D32] text-white text-xs">
                        {comment.author?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-[#F3F4F6] rounded-2xl px-4 py-2">
                        <p className="font-medium text-sm text-[#111827]">
                          {comment.author?.full_name || "Utilisateur"}
                        </p>
                        <p className="text-sm text-[#4B5563]">{comment.content}</p>
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-1 ml-2">
                        {formatTimeAgo(comment.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#E5E7EB] pt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#2F7D32] text-white text-xs">
                    {user?.email?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2 bg-[#F3F4F6] rounded-full px-4">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Écrire un commentaire..."
                    className="border-0 bg-transparent focus-visible:ring-0 px-0"
                    onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={submitComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="text-[#2F7D32] hover:text-[#256427]"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
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
    </div>
  )
}

// Composant FeedCard
function FeedCard({ 
  item, 
  onLike, 
  onComment, 
  onShare, 
  onSave,
  onFollow,
  formatPrice,
  formatTimeAgo
}: { 
  item: FeedItem
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onSave: () => void
  onFollow: () => void
  formatPrice: (price: number) => string
  formatTimeAgo: (date: string) => string
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  const isProduct = item.type === "product"
  const data = item.data
  const profile = data.profiles
  const images = isProduct ? (data as Product).images : (data as Post).media_urls
  const productName = isProduct ? (data as Product).name : ""
  const hasMultipleImages = images && images.length > 1

  return (
    <article className="bg-white">
      {/* Header auteur */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link 
          href={isProduct ? `/vendeur/${(data as Product).seller_id}` : `/profil/${(data as Post).author_id}`} 
          className="flex items-center gap-3"
        >
          <Avatar className="h-11 w-11 border-2 border-[#E5E7EB]">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className={cn(
              "text-white text-sm",
              isProduct ? "bg-[#2F7D32]" : "bg-[#F39A1F]"
            )}>
              {profile?.full_name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#111827] text-sm">
                {profile?.full_name || "Utilisateur"}
              </span>
              {profile?.is_verified && (
                <BadgeCheck className="h-4 w-4 text-[#2F7D32]" />
              )}
            </div>
            <p className="text-xs text-[#4B5563] flex items-center gap-1">
              {isProduct ? (
                <>
                  <MapPin className="h-3 w-3" />
                  {(data as Product).origin_region || (data as Product).location || profile?.city || "Afrique"}
                </>
              ) : (
                <>
                  {(profile as any)?.user_type || "Membre"} · {formatTimeAgo(data.created_at)}
                </>
              )}
            </p>
          </div>
        </Link>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onFollow}
            className="rounded-full h-8 px-3 bg-transparent border-[#F39A1F] text-[#F39A1F] text-xs font-semibold hover:bg-[#F39A1F]/10"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Suivre
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
            <MoreHorizontal className="h-5 w-5 text-[#4B5563]" />
          </Button>
        </div>
      </div>

      {/* Contenu texte (posts) */}
      {!isProduct && (data as Post).content && (
        <div className="px-4 pb-3">
          <p className="text-[#111827] text-sm leading-relaxed whitespace-pre-wrap">
            {(data as Post).content}
          </p>
        </div>
      )}

      {/* Images */}
      {images && images.length > 0 && (
        <div className="relative">
          <div className="relative aspect-square bg-[#F3F4F6] overflow-hidden">
            <Image
              src={images[currentImageIndex] || "/placeholder.svg"}
              alt={isProduct ? (data as Product).name : "Publication"}
              fill
              className="object-cover"
            />
          </div>

          {hasMultipleImages && (
            <>
              <button
                onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      idx === currentImageIndex ? "bg-white" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            </>
          )}

          {isProduct && (
            <div className="absolute top-3 left-3 bg-[#2F7D32] text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Produit
            </div>
          )}
        </div>
      )}

      {/* Info produit */}
      {isProduct && (
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <Link href={`/produit/${data.id}`}>
            <h3 className="font-semibold text-[#111827] mb-1">{(data as Product).name}</h3>
            <p className="text-lg font-bold text-[#2F7D32]">
              {formatPrice((data as Product).price)} FCFA
              <span className="text-sm font-normal text-[#4B5563]">/{(data as Product).unit}</span>
            </p>
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          {/* J'aime */}
          <button onClick={onLike} className="flex items-center gap-1.5 active:scale-90 transition-transform">
            <Heart className={cn(
              "h-6 w-6 transition-colors",
              item.isLiked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]"
            )} />
            <span className={cn(
              "text-sm font-medium",
              item.isLiked ? "text-[#F39A1F]" : "text-[#4B5563]"
            )}>
              {data.likes_count || 0}
            </span>
          </button>

          {/* Commenter */}
          <button onClick={onComment} className="flex items-center gap-1.5 text-[#4B5563] active:scale-90 transition-transform">
            <MessageCircle className="h-6 w-6" />
            <span className="text-sm font-medium">{data.comments_count || 0}</span>
          </button>

          {/* Partager */}
          <button onClick={onShare} className="flex items-center gap-1.5 text-[#4B5563] active:scale-90 transition-transform">
            <Share2 className="h-6 w-6" />
            <span className="text-sm font-medium">{data.shares_count || 0}</span>
          </button>
        </div>

        {/* Sauvegarder (produits uniquement) */}
        {isProduct && (
          <button onClick={onSave} className="active:scale-90 transition-transform">
            <Bookmark className={cn(
              "h-6 w-6 transition-colors",
              item.isSaved ? "fill-[#2F7D32] text-[#2F7D32]" : "text-[#4B5563]"
            )} />
          </button>
        )}
      </div>

      {/* CTA Acheter (produits uniquement) */}
      {isProduct && (
        <div className="px-4 pb-4">
          <Link href={`/produit/${data.id}`}>
            <Button className="w-full rounded-full bg-[#2F7D32] hover:bg-[#256427] text-white font-semibold">
              Acheter maintenant
            </Button>
          </Link>
        </div>
      )}
    </article>
  )
}
