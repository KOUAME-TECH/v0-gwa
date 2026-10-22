"use client"

import React, { Suspense, useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { ChatList } from "@/components/chat/chat-list"
import { ChatConversation } from "@/components/chat/chat-conversation"

interface Conversation {
  id: string
  participant_1: string
  participant_2: string
  conversation_type: string
  last_message_at: string
  is_pinned_1?: boolean
  is_pinned_2?: boolean
  other_user?: {
    id: string
    full_name: string
    avatar_url: string
    user_type: string
  }
  last_message?: string
  last_message_type?: string
  last_message_sender_id?: string
  last_message_is_read?: boolean
  unread_count?: number
}

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recipientId = searchParams.get("to")
  const convType = searchParams.get("type")

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const handledRef = useRef<string | null>(null)
  const supabase = createClient()

  const loadConversations = useCallback(async (uid: string): Promise<Conversation[]> => {
    const { data: rawConvs } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${uid},participant_2.eq.${uid}`)
      .order("last_message_at", { ascending: false })

    if (!rawConvs || rawConvs.length === 0) return []

    const otherIds = [...new Set(rawConvs.map(c => c.participant_1 === uid ? c.participant_2 : c.participant_1))]

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, user_type")
      .in("id", otherIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))
    const convIds = rawConvs.map(c => c.id)

    // Fetch last messages in parallel for all conversations
    const msgResults = await Promise.all(
      convIds.map(cid =>
        supabase.from("messages")
          .select("content, message_type, conversation_id, sender_id, is_read")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    )

    const lastMsgMap = new Map<string, {
      content: string
      message_type: string
      sender_id: string
      is_read: boolean
    }>()
    for (const r of msgResults) {
      if (r.data) {
        lastMsgMap.set(r.data.conversation_id, {
          content: r.data.content,
          message_type: r.data.message_type,
          sender_id: r.data.sender_id,
          is_read: !!r.data.is_read,
        })
      }
    }

    // Batch count unreads in parallel
    const unreadResults = await Promise.all(
      convIds.map(cid =>
        supabase.from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", cid)
          .eq("is_read", false)
          .neq("sender_id", uid)
      )
    )
    const unreadMap = new Map<string, number>()
    convIds.forEach((cid, i) => { unreadMap.set(cid, unreadResults[i].count || 0) })

    return rawConvs.map(c => {
      const otherId = c.participant_1 === uid ? c.participant_2 : c.participant_1
      const lm = lastMsgMap.get(c.id)
      return {
        ...c,
        other_user: profileMap.get(otherId) || undefined,
        last_message: lm?.content,
        last_message_type: lm?.message_type,
        last_message_sender_id: lm?.sender_id,
        last_message_is_read: lm?.is_read,
        unread_count: unreadMap.get(c.id) || 0,
      }
    })
   
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) { router.push("/auth/login?redirect=/messages"); return }
        if (!mounted) return
        setUser(u)

        const [profRes, convs] = await Promise.all([
          supabase.from("profiles").select("user_type").eq("id", u.id).single(),
          loadConversations(u.id),
        ])

        if (!mounted) return
        if (profRes.data) setUserType(profRes.data.user_type)
        setConversations(convs)
      } catch (err) {
        console.error("[v0] Messages init error:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  // ── Supabase Realtime : nouveaux messages entrants ──────────────────────────
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string
            conversation_id: string
            sender_id: string
            content: string
            created_at: string
            status: string
          }

          // Mettre à jour le badge non-lu sur la bonne conversation
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === newMsg.conversation_id
                ? { ...conv, unread_count: (conv.unread_count ?? 0) + 1, last_message: newMsg.content }
                : conv
            )
          )

          // Son de notification si pas dans cette conversation
          if (!selectedConv || selectedConv.id !== newMsg.conversation_id) {
            new Audio('/sounds/message.mp3').play().catch(() => null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, selectedConv])

  // Handle "to" param - open existing or create new conversation
  useEffect(() => {
    if (!user || !recipientId || loading) return
    if (recipientId === user.id) return
    if (handledRef.current === recipientId) return
    handledRef.current = recipientId

    async function openOrCreate() {
      // Check existing conversations
      const existing = conversations.find(c =>
        c.other_user?.id === recipientId ||
        c.participant_1 === recipientId ||
        c.participant_2 === recipientId
      )
      if (existing) { setSelectedConv(existing); return }

      // Check if conversation exists in DB but not loaded
      const { data: dbConv } = await supabase.from("conversations")
        .select("*")
        .or(`and(participant_1.eq.${user!.id},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${user!.id})`)
        .single()

      if (dbConv) {
        const { data: p } = await supabase.from("profiles")
          .select("id, full_name, avatar_url, user_type")
          .eq("id", recipientId!)
          .single()
        const conv: Conversation = { ...dbConv, other_user: p || undefined, unread_count: 0 }
        setConversations(prev => [conv, ...prev])
        setSelectedConv(conv)
        return
      }

      // Create new conversation
      const { data: nc } = await supabase.from("conversations").insert({
        participant_1: user!.id,
        participant_2: recipientId,
        conversation_type: convType || "private",
        last_message_at: new Date().toISOString(),
      }).select().single()

      if (nc) {
        const { data: p } = await supabase.from("profiles")
          .select("id, full_name, avatar_url, user_type")
          .eq("id", recipientId!)
          .single()
        const newConv: Conversation = { ...nc, other_user: p || undefined, unread_count: 0 }
        setConversations(prev => [newConv, ...prev])
        setSelectedConv(newConv)
      }
    }
    openOrCreate()
     
  }, [user, recipientId, loading])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-[3px] border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#667781] text-sm">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] lg:min-h-[calc(100dvh-3.5rem)] lg:flex lg:bg-[#f0f2f5]">
      <div
        className={
          selectedConv
            ? "hidden lg:block lg:w-[360px] xl:w-[380px] lg:shrink-0 lg:border-r lg:border-[#E5E7EB] lg:bg-white lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
            : "w-full lg:w-[360px] xl:w-[380px] lg:shrink-0 lg:border-r lg:border-[#E5E7EB] lg:bg-white lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
        }
      >
        <ChatList
          conversations={conversations}
          userId={user?.id || ""}
          userType={userType}
          onSelectConversation={setSelectedConv}
        />
      </div>

      <div
        className={
          selectedConv && user
            ? "flex-1 min-w-0 min-h-[100dvh] lg:min-h-0 lg:h-[calc(100dvh-3.5rem)]"
            : "hidden lg:flex flex-1 min-w-0 items-center justify-center bg-[#efeae2]"
        }
      >
        {selectedConv && user ? (
          <ChatConversation
            conversation={selectedConv}
            userId={user.id}
            onBack={async () => {
              setSelectedConv(null)
              if (user) {
                const convs = await loadConversations(user.id)
                setConversations(convs)
              }
            }}
          />
        ) : (
          <div className="text-center px-8">
            <p className="text-lg font-semibold text-[#111827] mb-1">GWA Chat</p>
            <p className="text-sm text-[#667781] max-w-xs mx-auto">
              Sélectionne une conversation pour discuter, négocier ou envoyer une offre.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-[3px] border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#667781] text-sm">Chargement...</p>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
