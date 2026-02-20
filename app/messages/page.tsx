"use client"

import React, { Suspense, useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { ChatList } from "@/components/chat/chat-list"
import { ChatConversation } from "@/components/chat/chat-conversation"
import { toast } from "sonner"

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
          .select("content, message_type, conversation_id")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    )

    const lastMsgMap = new Map<string, { content: string; message_type: string }>()
    for (const r of msgResults) {
      if (r.data) lastMsgMap.set(r.data.conversation_id, { content: r.data.content, message_type: r.data.message_type })
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
        unread_count: unreadMap.get(c.id) || 0,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) { router.push("/auth/login?redirect=/messages"); return }
        if (!mounted) return
        setUser(u)

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
              return {
                id: gc.id, name: gc.name, avatar_url: gc.avatar_url,
                group_type: gc.group_type || "private",
                last_message_at: gc.updated_at, unread_count: 0, member_count: 0
              }
            })
          setGroups(g)
        }
      } catch (err) {
        console.error("[v0] Messages init error:", err)
      } finally {
        if (mounted) setLoading(false)
      }
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
      c.other_user?.id === recipientId ||
      c.participant_1 === recipientId ||
      c.participant_2 === recipientId
    )
    if (existing) { setSelectedConv(existing); return }

    async function create() {
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
    create()
  }, [user, recipientId, loading, conversations, convType, supabase])

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
          if (user) {
            const convs = await loadConversations(user.id)
            setConversations(convs)
          }
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
      onSelectGroup={(g) => toast.info(`Groupe "${g.name}" - Chat de groupe bientôt disponible`)}
      onGroupCreated={(g) => setGroups(prev => [g, ...prev])}
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
