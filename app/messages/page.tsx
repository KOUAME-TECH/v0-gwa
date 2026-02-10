"use client"

import React, { Suspense, useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { ChatList } from "@/components/chat/chat-list"
import { ChatConversation } from "@/components/chat/chat-conversation"
import { toast } from "react-toastify"; // Import toast

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
  unread_count?: number
}

interface GroupConversation {
  id: string
  name: string
  avatar_url?: string
  group_type: string
  last_message?: string
  last_sender?: string
  last_message_at?: string
  unread_count?: number
  member_count?: number
}

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recipientId = searchParams.get("to")
  const convType = searchParams.get("type")

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [groups, setGroups] = useState<GroupConversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const handledRef = useRef<string | null>(null)
  const supabase = createClient()

  // Batch-load all conversations with profiles in ONE query via join
  const loadConversations = useCallback(async (uid: string) => {
    const { data: rawConvs } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${uid},participant_2.eq.${uid}`)
      .order("last_message_at", { ascending: false })

    if (!rawConvs || rawConvs.length === 0) return []

    // Collect all other-user IDs
    const otherIds = rawConvs.map(c => c.participant_1 === uid ? c.participant_2 : c.participant_1)
    const uniqueIds = [...new Set(otherIds)]

    // Batch fetch all profiles at once
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, user_type")
      .in("id", uniqueIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    // Batch fetch last messages for all conversations
    // Use a single query with conversation_id IN (...)
    const convIds = rawConvs.map(c => c.id)
    const { data: allLastMsgs } = await supabase.rpc('get_last_messages_batch', { conv_ids: convIds }).catch(() => ({ data: null }))

    // Fallback: if RPC doesn't exist, get last messages one by one but in parallel
    let lastMsgMap = new Map<string, { content: string; message_type: string }>()
    if (allLastMsgs) {
      for (const m of allLastMsgs) {
        lastMsgMap.set(m.conversation_id, { content: m.content, message_type: m.message_type })
      }
    } else {
      // Parallel fetch (still faster than sequential)
      const msgResults = await Promise.all(
        convIds.map(cid =>
          supabase.from("messages").select("content, message_type, conversation_id")
            .eq("conversation_id", cid).order("created_at", { ascending: false }).limit(1).single()
        )
      )
      for (const r of msgResults) {
        if (r.data) lastMsgMap.set(r.data.conversation_id, { content: r.data.content, message_type: r.data.message_type })
      }
    }

    // Batch count unreads
    const unreadResults = await Promise.all(
      convIds.map(cid =>
        supabase.from("messages").select("*", { count: "exact", head: true })
          .eq("conversation_id", cid).eq("is_read", false).neq("sender_id", uid)
      )
    )
    const unreadMap = new Map<string, number>()
    convIds.forEach((cid, i) => { unreadMap.set(cid, unreadResults[i].count || 0) })

    const enriched: Conversation[] = rawConvs.map(c => {
      const otherId = c.participant_1 === uid ? c.participant_2 : c.participant_1
      const lm = lastMsgMap.get(c.id)
      return {
        ...c,
        other_user: profileMap.get(otherId) || undefined,
        last_message: lm?.content,
        last_message_type: lm?.message_type,
        unread_count: unreadMap.get(c.id) || 0,
      }
    })
    return enriched
  }, [supabase])

  // Init
  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/auth/login?redirect=/messages"); return }
      if (!mounted) return
      setUser(u)

      // Parallel: profile + conversations + groups
      const [profRes, convs, grpRes] = await Promise.all([
        supabase.from("profiles").select("user_type").eq("id", u.id).single(),
        loadConversations(u.id),
        supabase.from("group_members")
          .select("group_id, group_conversations(id, name, avatar_url, group_type, updated_at)")
          .eq("user_id", u.id),
      ])

      if (!mounted) return
      if (profRes.data) setUserType(profRes.data.user_type)
      setConversations(convs)

      if (grpRes.data) {
        const g: GroupConversation[] = grpRes.data
          .filter((m: any) => m.group_conversations)
          .map((m: any) => {
            const gc = m.group_conversations
            return { id: gc.id, name: gc.name, avatar_url: gc.avatar_url, group_type: gc.group_type || "private", last_message_at: gc.updated_at, unread_count: 0, member_count: 0 }
          })
        setGroups(g)
      }
      setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [])

  // Handle "to" param
  useEffect(() => {
    if (!user || !recipientId || loading) return
    if (recipientId === user.id) return
    if (handledRef.current === recipientId) return
    handledRef.current = recipientId

    const existing = conversations.find(c =>
      c.other_user?.id === recipientId || c.participant_1 === recipientId || c.participant_2 === recipientId
    )
    if (existing) { setSelectedConv(existing); return }

    async function create() {
      const { data: nc } = await supabase.from("conversations").insert({
        participant_1: user!.id, participant_2: recipientId,
        conversation_type: convType || "private", last_message_at: new Date().toISOString(),
      }).select().single()

      if (nc) {
        const { data: p } = await supabase.from("profiles")
          .select("id, full_name, avatar_url, user_type").eq("id", recipientId!).single()
        const newConv: Conversation = { ...nc, other_user: p || undefined, unread_count: 0 }
        setConversations(prev => [newConv, ...prev])
        setSelectedConv(newConv)
      }
    }
    create()
  }, [user, recipientId, loading, conversations])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-[3px] border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#667781] text-sm">Chargement...</p>
      </div>
    )
  }

  if (selectedConv && user) {
    return (
      <ChatConversation
        conversation={selectedConv}
        userId={user.id}
        onBack={async () => {
          setSelectedConv(null)
          // Refresh in background
          const convs = await loadConversations(user.id)
          setConversations(convs)
        }}
      />
    )
  }

  return (
    <ChatList
      conversations={conversations}
      groups={groups}
      userId={user?.id || ""}
      userType={userType}
      onSelectConversation={setSelectedConv}
      onSelectGroup={(g) => toast.info(`Groupes bientôt disponibles : ${g.name}`)} // Use toast here
    />
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
