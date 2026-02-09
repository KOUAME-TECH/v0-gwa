"use client"

import React, { Suspense } from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Search, ChevronLeft, Send, Camera, Mic, MoreVertical, Phone, Video, Check, CheckCheck, Plus, Smile, ArrowLeft, ShoppingBag, UserPlus } from 'lucide-react'

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

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recipientId = searchParams.get("to")
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handledRecipientRef = useRef<string | null>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }, [])

  // Load user and conversations on mount
  useEffect(() => {
    async function init() {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !currentUser) {
          console.log("[v0] No auth user found, redirecting to login")
          router.push("/auth/login?redirect=/messages")
          return
        }

        console.log("[v0] User authenticated:", currentUser.id)
        setUser(currentUser)
        
        // Load conversations
        const { data: convData, error: convError } = await supabase
          .from("conversations")
          .select("*")
          .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
          .order("last_message_at", { ascending: false })

        console.log("[v0] Conversations loaded:", convData?.length, "error:", convError?.message)

        if (convError) {
          setError("Impossible de charger les conversations")
          setLoading(false)
          return
        }

        if (convData && convData.length > 0) {
          // Enrich conversations with user info
          const enriched = await Promise.all(
            convData.map(async (conv) => {
              const otherUserId = conv.participant_1 === currentUser.id ? conv.participant_2 : conv.participant_1
              
              const [profileRes, lastMsgRes, unreadRes] = await Promise.all([
                supabase.from("profiles").select("id, full_name, avatar_url, user_type").eq("id", otherUserId).single(),
                supabase.from("messages").select("content").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).single(),
                supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", currentUser.id),
              ])

              return {
                ...conv,
                other_user: profileRes.data || undefined,
                last_message: lastMsgRes.data?.content,
                unread_count: unreadRes.count || 0,
              }
            })
          )
          setConversations(enriched)
        }

        setLoading(false)
      } catch (err) {
        console.log("[v0] Init error:", err)
        setError("Une erreur est survenue")
        setLoading(false)
      }
    }
    init()
  }, [])

  // Handle "to" param - open or create conversation
  useEffect(() => {
    if (!user || !recipientId || loading) return
    if (recipientId === user.id) return
    if (handledRecipientRef.current === recipientId) return
    handledRecipientRef.current = recipientId

    async function openOrCreate() {
      // Check if conversation already exists
      const existing = conversations.find(c =>
        c.other_user?.id === recipientId ||
        c.participant_1 === recipientId ||
        c.participant_2 === recipientId
      )

      if (existing) {
        setSelectedConversation(existing)
        return
      }

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          participant_1: user!.id,
          participant_2: recipientId,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      console.log("[v0] New conversation created:", newConv?.id, "error:", createError?.message)

      if (newConv && !createError) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, user_type")
          .eq("id", recipientId)
          .single()

        const newConversation: Conversation = {
          ...newConv,
          other_user: profileData || undefined,
          last_message: undefined,
          unread_count: 0,
        }

        setConversations(prev => [newConversation, ...prev])
        setSelectedConversation(newConversation)
      }
    }

    openOrCreate()
  }, [user, recipientId, loading, conversations])

  // Load messages when conversation selected + realtime
  useEffect(() => {
    if (!selectedConversation) return

    async function loadMsgs() {
      const { data, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation!.id)
        .order("created_at", { ascending: true })

      console.log("[v0] Messages loaded:", data?.length, "error:", msgError?.message)
      if (data) {
        setMessages(data)
        scrollToBottom()
      }

      // Mark as read
      if (user) {
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", selectedConversation!.id)
          .neq("sender_id", user.id)
          .eq("is_read", false)
      }
    }

    loadMsgs()

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${selectedConversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` },
        (payload) => {
          console.log("[v0] Realtime message received:", payload.new)
          const newMsg = payload.new as Message
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
          
          // Mark as read if not own message
          if (user && newMsg.sender_id !== user.id) {
            supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || !user || sending) return

    setSending(true)
    const messageContent = newMessage.trim()
    setNewMessage("")

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
    }
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()

    const { data: insertedMsg, error: sendError } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: messageContent,
      })
      .select()
      .single()

    console.log("[v0] Message sent:", insertedMsg?.id, "error:", sendError?.message)

    if (sendError) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
      setNewMessage(messageContent) // Restore text
    } else if (insertedMsg) {
      // Replace temp with real message
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? insertedMsg : m))
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", selectedConversation.id)

    // Update local conversation list
    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation.id
          ? { ...c, last_message: messageContent, last_message_at: new Date().toISOString() }
          : c
      ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    )

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
    const labels: Record<string, string> = {
      farmer: "Producteur", producteur: "Producteur", artisan: "Artisan",
      acheteur: "Acheteur", buyer: "Acheteur", cooperative: "Coopérative",
      business: "Entreprise", entreprise: "Entreprise", transformateur: "Transformateur",
      student: "Apprenant",
    }
    return labels[type || ""] || "Membre"
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#4B5563] text-sm">Chargement des messages...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <Send className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="font-semibold text-[#111827]">{error}</h3>
        <Button onClick={() => window.location.reload()} variant="outline" className="rounded-full bg-transparent">
          Réessayer
        </Button>
      </div>
    )
  }

  // ========== CONVERSATION VIEW (WhatsApp style) ==========
  if (selectedConversation) {
    return (
      <div className="h-[100dvh] flex flex-col bg-[#FFF6E5]">
        {/* Header - Blue like WhatsApp but with our brand */}
        <header className="bg-[#1DA1F2] text-white px-2 py-2 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSelectedConversation(null)}
            className="p-2 -ml-1 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={selectedConversation.other_user?.avatar_url || ""} />
            <AvatarFallback className="bg-white/20 text-white font-semibold">
              {selectedConversation.other_user?.full_name?.charAt(0)?.toUpperCase() || "?"}
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

          <button className="p-2 rounded-full hover:bg-white/10"><Phone className="h-5 w-5" /></button>
          <button className="p-2 rounded-full hover:bg-white/10"><Video className="h-5 w-5" /></button>
          <button className="p-2 rounded-full hover:bg-white/10"><MoreVertical className="h-5 w-5" /></button>
        </header>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%231DA1F2' fillOpacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Send className="h-8 w-8 text-[#1DA1F2]" />
              </div>
              <h3 className="font-semibold text-[#111827] mb-2">Nouvelle conversation</h3>
              <p className="text-[#4B5563] text-sm">
                Envoyez un message pour démarrer la discussion avec{" "}
                <span className="font-medium">{selectedConversation.other_user?.full_name}</span>
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
                          month: 'long',
                        })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                      isOwn
                        ? "bg-[#d1ecf9] rounded-tr-sm"
                        : "bg-white rounded-tl-sm"
                    }`}>
                      <p className="text-[15px] text-[#111827] whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
                        <span className="text-[11px] text-[#4B5563]">
                          {new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && (
                          message.is_read
                            ? <CheckCheck className="h-3.5 w-3.5 text-[#1DA1F2]" />
                            : <Check className="h-3.5 w-3.5 text-[#4B5563]" />
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

        {/* Input bar */}
        <form onSubmit={sendMessage} className="p-2 bg-[#f0f2f5] shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
              <button type="button" className="p-1.5 text-[#54656f] shrink-0">
                <Smile className="h-6 w-6" />
              </button>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message"
                className="flex-1 border-0 bg-transparent h-10 text-[15px] focus:outline-none placeholder:text-[#8696a0] px-2"
              />
              <button type="button" className="p-1.5 text-[#54656f] shrink-0">
                <Camera className="h-6 w-6" />
              </button>
            </div>

            {newMessage.trim() ? (
              <button
                type="submit"
                disabled={sending}
                className="rounded-full h-12 w-12 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-sm flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full h-12 w-12 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-sm flex items-center justify-center shrink-0 active:scale-95 transition-all"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        </form>
      </div>
    )
  }

  // ========== CONVERSATIONS LIST (WhatsApp style) ==========
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1DA1F2] text-white">
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
            <input
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 bg-white/15 border-0 h-9 rounded-lg text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Conversations list */}
      <div className="divide-y divide-[#E5E7EB]">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-[#FFF6E5] min-h-[60vh]">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5 shadow-sm">
              <Send className="h-10 w-10 text-[#1DA1F2]" />
            </div>
            <h3 className="text-xl font-semibold text-[#111827] mb-2">Aucune conversation</h3>
            <p className="text-[#4B5563] text-sm max-w-xs mb-6">
              Contactez un vendeur ou un acheteur depuis le marketplace pour démarrer
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                onClick={() => router.push("/marketplace")}
                className="rounded-full bg-[#1DA1F2] hover:bg-[#1a8cd8] w-full"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Explorer le marketplace
              </Button>
              <Button
                onClick={() => router.push("/network")}
                variant="outline"
                className="rounded-full bg-transparent w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Trouver des contacts
              </Button>
            </div>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f6f6] active:bg-[#edeef0] transition-colors text-left"
            >
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={conv.other_user?.avatar_url || ""} />
                <AvatarFallback className="bg-[#1DA1F2]/10 text-[#1DA1F2] text-lg font-semibold">
                  {conv.other_user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-semibold text-[#111827] truncate">
                    {conv.other_user?.full_name || "Utilisateur"}
                  </h3>
                  <span className={`text-xs shrink-0 ml-2 ${conv.unread_count ? "text-[#1DA1F2] font-medium" : "text-[#4B5563]"}`}>
                    {conv.last_message_at && formatTime(conv.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${conv.unread_count ? "text-[#111827] font-medium" : "text-[#4B5563]"}`}>
                    {conv.last_message || "Nouvelle conversation"}
                  </p>
                  {(conv.unread_count ?? 0) > 0 && (
                    <span className="ml-2 min-w-[22px] h-[22px] px-1.5 bg-[#1DA1F2] text-white text-xs font-medium rounded-full flex items-center justify-center shrink-0">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* FAB new conversation */}
      <button
        onClick={() => router.push("/network")}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#1DA1F2] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

// Wrap with Suspense for useSearchParams
export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#4B5563] text-sm">Chargement des messages...</p>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
