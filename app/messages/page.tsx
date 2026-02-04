"use client"

import React from "react"
import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Search, ChevronLeft, Send, Camera, Mic, MoreVertical, Phone, Video, Check, CheckCheck, Plus, Smile } from 'lucide-react'

interface Conversation {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string
  other_user?: {
    id: string
    full_name: string
    avatar_url: string
    user_type: string
  }
  last_message?: string
  unread_count?: number
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean
}

export default function MessagesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    checkUserAndLoadConversations()
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      markAsRead(selectedConversation.id)
      
      const channel = supabase
        .channel(`messages:${selectedConversation.id}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message])
            scrollToBottom()
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
  }, [selectedConversation, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function checkUserAndLoadConversations() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    setUser(currentUser)
    await loadConversations(currentUser.id)
    setLoading(false)
  }

  async function loadConversations(userId: string) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order("last_message_at", { ascending: false })

    if (data) {
      const conversationsWithUsers = await Promise.all(
        data.map(async (conv) => {
          const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, user_type")
            .eq("id", otherUserId)
            .single()
          
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
          
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("is_read", false)
            .neq("sender_id", userId)

          return { 
            ...conv, 
            other_user: profileData, 
            last_message: lastMsg?.content,
            unread_count: count || 0 
          }
        })
      )
      setConversations(conversationsWithUsers)
    }
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
    if (data) setMessages(data)
  }

  async function markAsRead(conversationId: string) {
    if (!user) return
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || !user || sending) return

    setSending(true)
    const messageContent = newMessage.trim()
    setNewMessage("")

    await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: messageContent,
    })

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", selectedConversation.id)

    await loadConversations(user.id)
    setSending(false)
  }

  const filteredConversations = conversations.filter(c =>
    c.other_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return "Hier"
    if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  const getUserTypeLabel = (type: string | undefined) => {
    switch (type) {
      case "farmer": return "Producteur"
      case "producteur": return "Producteur"
      case "artisan": return "Artisan"
      case "acheteur": return "Acheteur"
      case "buyer": return "Acheteur"
      case "cooperative": return "Coopérative"
      case "business": return "Entreprise"
      case "student": return "Étudiant"
      default: return "Membre"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#2F7D32] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Vue conversation ouverte (style WhatsApp)
  if (selectedConversation) {
    return (
      <div className="h-screen flex flex-col bg-[#FFF6E5]">
        {/* Header conversation - style WhatsApp vert */}
        <header className="bg-[#2F7D32] text-white px-2 py-2 flex items-center gap-2 shrink-0 safe-top">
          <button onClick={() => setSelectedConversation(null)} className="p-2 -ml-1 rounded-full hover:bg-white/10 active:bg-white/20">
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={selectedConversation.other_user?.avatar_url || ""} />
            <AvatarFallback className="bg-white/20 text-white">
              {selectedConversation.other_user?.full_name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate text-[15px]">
              {selectedConversation.other_user?.full_name || "Utilisateur"}
            </h2>
            <p className="text-xs text-white/70">
              {getUserTypeLabel(selectedConversation.other_user?.user_type)}
            </p>
          </div>
          
          <button className="p-2 rounded-full hover:bg-white/10">
            <Video className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10">
            <Phone className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10">
            <MoreVertical className="h-5 w-5" />
          </button>
        </header>

        {/* Zone messages avec pattern subtle */}
        <div 
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%232F7D32' fillOpacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Send className="h-8 w-8 text-[#2F7D32]" />
              </div>
              <h3 className="font-semibold text-[#111827] mb-2">Nouvelle conversation</h3>
              <p className="text-[#4B5563] text-sm">
                Envoyez un message pour démarrer la discussion
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id
              const showDate = index === 0 || 
                new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString()

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-[#4B5563] bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
                        {new Date(message.created_at).toLocaleDateString('fr-FR', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                      isOwn 
                        ? "bg-[#dcf8c6] rounded-tr-sm" 
                        : "bg-white rounded-tl-sm"
                    }`}>
                      <p className="text-[15px] text-[#111827] whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </p>
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
                        <span className="text-[11px] text-[#4B5563]">
                          {new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && (
                          message.is_read 
                            ? <CheckCheck className="h-4 w-4 text-[#53bdeb]" />
                            : <Check className="h-4 w-4 text-[#4B5563]" />
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input message - style WhatsApp */}
        <form onSubmit={sendMessage} className="p-2 bg-[#f0f2f5] shrink-0 safe-bottom">
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end bg-white rounded-3xl px-2 py-1 shadow-sm">
              <button type="button" className="p-2 text-[#54656f]">
                <Smile className="h-6 w-6" />
              </button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message"
                className="flex-1 border-0 bg-transparent h-10 text-[15px] focus-visible:ring-0 placeholder:text-[#8696a0]"
              />
              <button type="button" className="p-2 text-[#54656f]">
                <Camera className="h-6 w-6" />
              </button>
            </div>
            
            {newMessage.trim() ? (
              <Button 
                type="submit" 
                size="icon"
                disabled={sending}
                className="rounded-full h-12 w-12 bg-[#2F7D32] hover:bg-[#256427] shadow-sm"
              >
                <Send className="h-5 w-5" />
              </Button>
            ) : (
              <Button 
                type="button" 
                size="icon"
                className="rounded-full h-12 w-12 bg-[#2F7D32] hover:bg-[#256427] shadow-sm"
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </form>
      </div>
    )
  }

  // Liste des conversations
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#2F7D32] text-white safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Messages</h1>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-full hover:bg-white/10">
                <Camera className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-full hover:bg-white/10">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/10 border-0 h-9 rounded-lg text-white placeholder:text-white/60 focus-visible:ring-0"
            />
          </div>
        </div>
      </header>

      {/* Liste conversations */}
      <div className="divide-y divide-[#E5E7EB]">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#FFF6E5] min-h-[60vh]">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Send className="h-10 w-10 text-[#2F7D32]" />
            </div>
            <h3 className="text-xl font-semibold text-[#111827] mb-2">Aucune conversation</h3>
            <p className="text-[#4B5563] text-sm max-w-xs mb-6">
              Contactez un vendeur depuis sa fiche produit pour démarrer une conversation
            </p>
            <Button 
              onClick={() => router.push("/marketplace")}
              className="rounded-full bg-[#2F7D32] hover:bg-[#256427]"
            >
              Explorer le marketplace
            </Button>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f6f6] active:bg-[#edeef0] transition-colors text-left"
            >
              <Avatar className="h-14 w-14">
                <AvatarImage src={conv.other_user?.avatar_url || ""} />
                <AvatarFallback className="bg-[#2F7D32]/10 text-[#2F7D32] text-lg font-semibold">
                  {conv.other_user?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-semibold text-[#111827] truncate">
                    {conv.other_user?.full_name || "Utilisateur"}
                  </h3>
                  <span className={`text-xs shrink-0 ${conv.unread_count ? "text-[#2F7D32] font-medium" : "text-[#4B5563]"}`}>
                    {conv.last_message_at && formatTime(conv.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${conv.unread_count ? "text-[#111827] font-medium" : "text-[#4B5563]"}`}>
                    {conv.last_message || "Nouvelle conversation"}
                  </p>
                  {(conv.unread_count ?? 0) > 0 && (
                    <span className="ml-2 min-w-[22px] h-[22px] px-1.5 bg-[#2F7D32] text-white text-xs font-medium rounded-full flex items-center justify-center shrink-0">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* FAB nouvelle conversation */}
      <button className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#2F7D32] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform">
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
