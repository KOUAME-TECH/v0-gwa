"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Heart, MessageCircle, Share2, Bookmark,
  ImageIcon, Send, MapPin, TrendingUp, Users, Plus,
  Sprout, Hammer, Lightbulb, HelpCircle, X
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  post_type: string
  location: string | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles: {
    full_name: string
    avatar_url: string | null
    user_type: string
    city: string
  }
  user_has_liked?: boolean
}

interface Comment {
  id: string
  content: string
  created_at: string
  profiles: {
    full_name: string
    avatar_url: string | null
  }
}

const postTypes = [
  { value: "all", label: "Tout", icon: TrendingUp },
  { value: "general", label: "General", icon: MessageCircle },
  { value: "agriculture", label: "Agri", icon: Sprout },
  { value: "artisanat", label: "Artisanat", icon: Hammer },
  { value: "conseil", label: "Conseils", icon: Lightbulb },
  { value: "question", label: "Questions", icon: HelpCircle },
]

export default function CommunautePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [newPostContent, setNewPostContent] = useState("")
  const [newPostType, setNewPostType] = useState("general")
  const [posting, setPosting] = useState(false)
  const [selectedTab, setSelectedTab] = useState("all")
  const [showNewPost, setShowNewPost] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [selectedTab])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setUserProfile(profile)
    }

    let query = supabase
      .from("posts")
      .select(`*, profiles:author_id (full_name, avatar_url, user_type, city)`)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(50)

    if (selectedTab !== "all") {
      query = query.eq("post_type", selectedTab)
    }

    const { data: postsData } = await query

    if (postsData && user) {
      const { data: userLikes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)

      const likedPostIds = new Set(userLikes?.map(l => l.post_id) || [])
      setPosts(postsData.map(post => ({
        ...post,
        user_has_liked: likedPostIds.has(post.id)
      })))
    } else if (postsData) {
      setPosts(postsData)
    }

    setLoading(false)
  }

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return
    setPosting(true)

    const { data } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        content: newPostContent,
        post_type: newPostType,
        location: userProfile?.city,
        visibility: "public",
      })
      .select(`*, profiles:author_id (full_name, avatar_url, user_type, city)`)
      .single()

    if (data) {
      setPosts([data, ...posts])
      setNewPostContent("")
      setShowNewPost(false)
    }
    setPosting(false)
  }

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) return

    if (currentlyLiked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id })
    }

    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1,
          user_has_liked: !currentlyLiked
        }
      }
      return post
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold">Communaute</h1>
              <p className="text-xs text-muted-foreground">Echangez avec les membres GWA</p>
            </div>
            {user && (
              <Sheet open={showNewPost} onOpenChange={setShowNewPost}>
                <SheetTrigger asChild>
                  <Button size="sm" className="rounded-full gap-1">
                    <Plus className="h-4 w-4" />
                    Publier
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
                  <SheetHeader className="pb-4">
                    <SheetTitle>Nouvelle publication</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={userProfile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {userProfile?.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{userProfile?.full_name || "Vous"}</p>
                        <p className="text-xs text-muted-foreground">{userProfile?.city || "GWA"}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {postTypes.filter(t => t.value !== "all").map(type => (
                        <button
                          key={type.value}
                          onClick={() => setNewPostType(type.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                            newPostType === type.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <type.icon className="h-3.5 w-3.5" />
                          {type.label}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      placeholder="Partagez quelque chose..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="min-h-[150px] resize-none text-base"
                      autoFocus
                    />

                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <ImageIcon className="h-5 w-5" />
                      </Button>
                      <Button 
                        onClick={handleCreatePost} 
                        disabled={!newPostContent.trim() || posting}
                        className="rounded-full px-6"
                      >
                        {posting ? "Publication..." : "Publier"}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {postTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setSelectedTab(type.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedTab === type.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <type.icon className="h-3.5 w-3.5" />
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Posts */}
      <main className="p-4 space-y-4">
        {!user && (
          <div className="bg-card rounded-2xl p-4 text-center border border-border">
            <p className="text-sm text-muted-foreground mb-3">
              Connectez-vous pour participer
            </p>
            <Link href="/auth/login">
              <Button size="sm" className="rounded-full">Se connecter</Button>
            </Link>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">La communaute vous attend</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Soyez le premier a partager une experience ou poser une question
            </p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onLike={handleLike}
              isLoggedIn={!!user}
            />
          ))
        )}
      </main>
    </div>
  )
}

function PostCard({ post, onLike, isLoggedIn }: { 
  post: Post
  onLike: (postId: string, currentlyLiked: boolean) => void
  isLoggedIn: boolean
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loadingComments, setLoadingComments] = useState(false)
  const supabase = createClient()

  const loadComments = async () => {
    if (comments.length > 0) {
      setShowComments(!showComments)
      return
    }

    setLoadingComments(true)
    const { data } = await supabase
      .from("post_comments")
      .select(`*, profiles:user_id (full_name, avatar_url)`)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })

    if (data) setComments(data)
    setShowComments(true)
    setLoadingComments(false)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: user.id, content: newComment })
      .select(`*, profiles:user_id (full_name, avatar_url)`)
      .single()

    if (data) {
      setComments([...comments, data])
      setNewComment("")
    }
  }

  const postTypeColors: Record<string, string> = {
    agriculture: "bg-green-100 text-green-700",
    artisanat: "bg-orange-100 text-orange-700",
    conseil: "bg-blue-100 text-blue-700",
    question: "bg-purple-100 text-purple-700",
    general: "bg-gray-100 text-gray-700"
  }

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar>
          <AvatarImage src={post.profiles?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {post.profiles?.full_name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{post.profiles?.full_name || "Utilisateur"}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${postTypeColors[post.post_type] || postTypeColors.general}`}>
              {post.post_type}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {post.location && (
              <>
                <MapPin className="h-3 w-3" />
                <span>{post.location}</span>
                <span>·</span>
              </>
            )}
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
      </div>

      {post.image_url && (
        <div className="relative aspect-video bg-muted">
          <Image src={post.image_url || "/placeholder.svg"} alt="" fill className="object-cover" />
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => isLoggedIn && onLike(post.id, post.user_has_liked || false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              post.user_has_liked ? "text-red-500 bg-red-50" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Heart className={`h-4 w-4 ${post.user_has_liked ? "fill-current" : ""}`} />
            <span>{post.likes_count}</span>
          </button>
          <button 
            onClick={loadComments}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.comments_count}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {comment.profiles?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted rounded-2xl px-3 py-2">
                    <span className="font-medium text-xs">{comment.profiles?.full_name}</span>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              ))}

              {isLoggedIn && (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Commenter..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    className="flex-1 h-9 rounded-full bg-muted border-0 text-sm"
                  />
                  <Button 
                    size="icon" 
                    className="h-9 w-9 rounded-full shrink-0" 
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
