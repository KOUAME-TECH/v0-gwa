"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, 
  Send, Bookmark, CheckCircle, ChevronLeft, ChevronRight,
  Play, Pause, Volume2, VolumeX
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Post {
  id: string
  content: string
  media_urls: { url: string; type: string }[] | null
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  author_id: string
  post_type: string
  location: string | null
}

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  is_verified: boolean
  user_type: string
  city: string | null
}

interface Comment {
  id: string
  content: string
  created_at: string
  profiles: { id: string; full_name: string; avatar_url: string | null } | null
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [author, setAuthor] = useState<Profile | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Charger le post
      const { data: postData, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single()

      if (error || !postData) {
        toast.error("Publication introuvable")
        router.push("/")
        return
      }
      setPost(postData)

      // Charger l'auteur
      const { data: authorData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_verified, user_type, city")
        .eq("id", postData.author_id)
        .single()
      setAuthor(authorData)

      // Charger les commentaires
      const { data: rawComments } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })

      if (rawComments && rawComments.length > 0) {
        const authorIds = [...new Set(rawComments.map(c => c.author_id))]
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", authorIds)
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
        setComments(rawComments.map(c => ({ ...c, profiles: profileMap.get(c.author_id) || null })))
      }

      // Verifier si l'utilisateur a like
      if (authUser) {
        const { data: like } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", authUser.id)
          .single()
        setIsLiked(!!like)

        const { data: save } = await supabase
          .from("saved_posts")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", authUser.id)
          .single()
        setIsSaved(!!save)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [postId, router])

  const handleLike = async () => {
    if (!user) {
      toast.error("Connectez-vous pour aimer")
      return
    }
    const supabase = createClient()
    if (isLiked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
      setPost(p => p ? { ...p, likes_count: p.likes_count - 1 } : p)
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id })
      setPost(p => p ? { ...p, likes_count: p.likes_count + 1 } : p)
    }
    setIsLiked(!isLiked)
  }

  const handleSave = async () => {
    if (!user) {
      toast.error("Connectez-vous pour sauvegarder")
      return
    }
    const supabase = createClient()
    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id)
      toast.success("Retire des favoris")
    } else {
      await supabase.from("saved_posts").insert({ post_id: postId, user_id: user.id })
      toast.success("Ajoute aux favoris")
    }
    setIsSaved(!isSaved)
  }

  const handleComment = async () => {
    if (!user) {
      toast.error("Connectez-vous pour commenter")
      return
    }
    if (!newComment.trim()) return

    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, author_id: user.id, content: newComment.trim() })
      .select("*")
      .single()

    if (error) {
      toast.error("Erreur lors de l'envoi")
      setSubmitting(false)
      return
    }

    // Charger le profil de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single()

    setComments([...comments, { ...data, profiles: profile }])
    setPost(p => p ? { ...p, comments_count: p.comments_count + 1 } : p)
    setNewComment("")
    setSubmitting(false)
    toast.success("Commentaire ajoute")
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`
    try {
      await navigator.share({ title: "Publication GWA", url })
    } catch {
      await navigator.clipboard.writeText(url)
      toast.success("Lien copie")
    }
  }

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "A l'instant"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}j`
    return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F7D32]" />
      </div>
    )
  }

  if (!post || !author) return null

  const medias = post.media_urls || []
  const hasVideo = medias.some(m => m.type?.startsWith("video"))
  const hasMultipleMedias = medias.length > 1

  return (
    <div className="min-h-screen bg-[#FFF6E5] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-6 w-6 text-[#111827]" />
          </button>
          <h1 className="text-lg font-semibold text-[#111827]">Publication</h1>
        </div>
      </header>

      {/* Post */}
      <Card className="bg-white border-0 rounded-none">
        <CardContent className="p-0">
          {/* Auteur */}
          <div className="flex items-center justify-between px-4 py-3">
            <Link href={`/profil/${author.id}`} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={author.avatar_url || undefined} />
                <AvatarFallback className="bg-[#2F7D32] text-white">
                  {author.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#111827] text-sm">{author.full_name}</span>
                  {author.is_verified && <CheckCircle className="h-4 w-4 text-[#1DA1F2] fill-[#1DA1F2]" />}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
                  {author.city && <span>{author.city}</span>}
                  <span>·</span>
                  <span>{formatTimeAgo(post.created_at)}</span>
                </div>
              </div>
            </Link>
            <button className="p-2">
              <MoreHorizontal className="h-5 w-5 text-[#4B5563]" />
            </button>
          </div>

          {/* Contenu */}
          {post.content && (
            <div className="px-4 pb-3">
              <p className="text-[#111827] text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          )}

          {/* Medias */}
          {medias.length > 0 && (
            <div className="relative">
              {medias[currentMediaIndex]?.type?.startsWith("video") ? (
                <div className="relative aspect-video bg-black">
                  <video
                    src={medias[currentMediaIndex].url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="relative aspect-square bg-[#F3F4F6]">
                  <Image
                    src={medias[currentMediaIndex].url || "/placeholder.svg"}
                    alt="Publication"
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {hasMultipleMedias && (
                <>
                  <button
                    onClick={() => setCurrentMediaIndex(p => p > 0 ? p - 1 : medias.length - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentMediaIndex(p => p < medias.length - 1 ? p + 1 : 0)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {medias.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          idx === currentMediaIndex ? "bg-white" : "bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-5">
              <button onClick={handleLike} className="flex items-center gap-1.5">
                <Heart className={cn("h-6 w-6", isLiked ? "fill-red-500 text-red-500" : "text-[#111827]")} />
                <span className="text-sm font-medium">{post.likes_count}</span>
              </button>
              <button className="flex items-center gap-1.5">
                <MessageCircle className="h-6 w-6 text-[#111827]" />
                <span className="text-sm font-medium">{post.comments_count}</span>
              </button>
              <button onClick={handleShare} className="flex items-center gap-1.5">
                <Share2 className="h-6 w-6 text-[#111827]" />
                <span className="text-sm font-medium">{post.shares_count}</span>
              </button>
            </div>
            <button onClick={handleSave}>
              <Bookmark className={cn("h-6 w-6", isSaved ? "fill-[#111827] text-[#111827]" : "text-[#111827]")} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Commentaires */}
      <div className="bg-white mt-2">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-[#111827]">Commentaires ({comments.length})</h2>
        </div>

        {comments.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[#4B5563]">Aucun commentaire pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <div key={comment.id} className="px-4 py-3 flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-[#E5E7EB] text-[#4B5563] text-xs">
                    {comment.profiles?.full_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-[#111827] text-sm">{comment.profiles?.full_name || "Utilisateur"}</span>
                    <span className="text-xs text-[#4B5563]">{formatTimeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#111827]">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input commentaire */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-bottom">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-[#2F7D32] text-white text-xs">
                {user?.email?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="min-h-[40px] max-h-[100px] py-2 pr-12 resize-none rounded-full bg-[#F3F4F6] border-0"
                rows={1}
              />
              <Button
                onClick={handleComment}
                disabled={!newComment.trim() || submitting}
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[#2F7D32] hover:bg-[#256025] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
