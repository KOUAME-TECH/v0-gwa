"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Heart, Share2, BadgeCheck } from "lucide-react"
import { toast } from "sonner"
import { ClickableListenText } from "@/components/media/clickable-listen-text"
import { CommentComposer } from "@/components/comments/comment-composer"
import { loadFeedComments, type FeedCommentRow } from "@/lib/comments/feed-comments"
import { VOICE_COMMENT_PLACEHOLDER } from "@/lib/comments/voice-comment"
import { cn } from "@/lib/utils"

type Post = {
  id: string
  content: string
  media_urls: { url: string; type: string }[] | null
  audio_url: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  author_id: string
}

type Profile = {
  id: string
  full_name: string
  avatar_url: string | null
  is_verified: boolean
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const supabase = createClient()

  const [post, setPost] = useState<Post | null>(null)
  const [author, setAuthor] = useState<Profile | null>(null)
  const [comments, setComments] = useState<FeedCommentRow[]>([])
  const [commentText, setCommentText] = useState("")
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const { data: postData, error } = await supabase
        .from("posts")
        .select("id, content, media_urls, audio_url, likes_count, comments_count, shares_count, created_at, author_id")
        .eq("id", postId)
        .maybeSingle()

      if (error || !postData) {
        toast.error("Publication introuvable")
        setLoading(false)
        return
      }

      setPost(postData as Post)
      setLikesCount(postData.likes_count || 0)

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_verified")
        .eq("id", postData.author_id)
        .maybeSingle()
      if (profile) setAuthor(profile as Profile)

      if (authUser) {
        const { data: like } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", authUser.id)
          .maybeSingle()
        setIsLiked(!!like)
      }

      const loaded = await loadFeedComments(supabase, { type: "post", id: postId })
      setComments(loaded)
      setLoading(false)
    }
    load()
  }, [postId, supabase])

  const toggleLike = async () => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    if (isLiked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
      setIsLiked(false)
      setLikesCount((c) => Math.max(0, c - 1))
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id })
      setIsLiked(true)
      setLikesCount((c) => c + 1)
    }
  }

  const submitComment = async (voice: { file: File; url: string } | null) => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    setSubmitting(true)
    try {
      const hasText = !!commentText.trim()
      const hasVoice = !!voice?.file?.size
      if (!hasText && !hasVoice) {
        toast.error("Écris un message ou envoie un vocal")
        return
      }
      const form = new FormData()
      form.append("type", "post")
      form.append("id", postId)
      if (hasText) form.append("text", commentText.trim())
      if (hasVoice && voice) form.append("audio", voice.file)
      const res = await fetch("/api/comments", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Envoi impossible")
      }
      setCommentText("")
      const loaded = await loadFeedComments(supabase, { type: "post", id: postId })
      setComments(loaded)
      toast.success("Commentaire publié")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF6E5]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1F5C2E] border-t-transparent" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] p-6 text-center">
        <p className="mb-4">Publication introuvable</p>
        <Button asChild><Link href="/">Retour au feed</Link></Button>
      </div>
    )
  }

  const medias = (post.media_urls || []).map((m) =>
    typeof m === "string" ? { url: m, type: "image" } : m,
  )

  return (
    <div className="min-h-screen bg-[#FFF6E5]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3">
        <button type="button" onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-[#111827]">Publication</h1>
      </header>

      <article className="bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={author?.avatar_url || undefined} />
            <AvatarFallback>{author?.full_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm flex items-center gap-1">
              {author?.full_name || "Utilisateur"}
              {author?.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
            </p>
            <p className="text-xs text-[#9CA3AF]">
              {new Date(post.created_at).toLocaleString("fr-FR")}
            </p>
          </div>
        </div>

        {(post.content || post.audio_url) && (
          <div className="px-4 pb-3">
            <ClickableListenText
              text={post.content}
              audioUrl={post.audio_url}
              fallbackLabel={VOICE_COMMENT_PLACEHOLDER}
            />
          </div>
        )}

        {medias[0] && (
          <div className="relative aspect-square bg-black/5">
            {medias[0].type === "video" ? (
              <video src={medias[0].url} controls className="h-full w-full object-contain" />
            ) : (
              <Image src={medias[0].url} alt="" fill className="object-cover" sizes="100vw" />
            )}
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-3">
          <button type="button" onClick={toggleLike} className="flex items-center gap-1.5 text-sm">
            <Heart className={cn("h-5 w-5", isLiked && "fill-red-500 text-red-500")} />
            {likesCount}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-[#4B5563]"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/post/${post.id}`)
              toast.success("Lien copié")
            }}
          >
            <Share2 className="h-5 w-5" />
            Partager
          </button>
        </div>
      </article>

      <section className="px-4 py-4 space-y-4">
        <h2 className="font-semibold text-sm text-[#111827]">Commentaires</h2>
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={c.author?.avatar_url || undefined} />
              <AvatarFallback>{c.author?.full_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-2xl bg-white border border-[#E5E7EB] px-3 py-2">
              <p className="text-xs font-medium mb-1">{c.author?.full_name || "Utilisateur"}</p>
              <ClickableListenText
                text={c.content}
                audioUrl={c.audio_url}
                fallbackLabel={VOICE_COMMENT_PLACEHOLDER}
                textClassName="text-sm"
              />
            </div>
          </div>
        ))}

        <CommentComposer
          userInitial={user ? "?" : "?"}
          value={commentText}
          onChange={setCommentText}
          onSubmit={submitComment}
          submitting={submitting}
          loggedIn={!!user}
          onAuthRequired={() => router.push("/auth/login")}
        />
      </section>
    </div>
  )
}
