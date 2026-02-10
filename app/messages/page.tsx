"use client"

import React, { Suspense } from "react"
import { useEffect, useState, useRef } from "react"
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
  const convType = searchParams.get("type") // "business" or null

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [groups, setGroups] = useState<GroupConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const handledRecipientRef = useRef<string | null>(null)
  const supabase = createClient()

  // Init: load user, conversations, groups
  useEffect(() => {
    async function init() {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !currentUser) {
          router.push("/auth/login?redirect=/messages")
          return
        }

        setUser(currentUser)

        // Load profile, conversations, groups in parallel
        const [profileRes, convRes, groupMembershipsRes] = await Promise.all([
          supabase.from("profiles").select("user_type").eq("id", currentUser.id).single(),
          supabase.from("conversations")
            .select("*")
            .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
            .order("last_message_at", { ascending: false }),
          supabase.from("group_members")
            .select("group_id, group_conversations(id, name, avatar_url, group_type, created_at, updated_at)")
            .eq("user_id", currentUser.id),
        ])

        if (profileRes.data) setUserType(profileRes.data.user_type)

        // Enrich conversations
        if (convRes.data && convRes.data.length > 0) {
          const enriched = await Promise.all(
            convRes.data.map(async (conv) => {
              const otherUserId = conv.participant_1 === currentUser.id ? conv.participant_2 : conv.participant_1

              const [profileR, lastMsgR, unreadR] = await Promise.all([
                supabase.from("profiles").select("id, full_name, avatar_url, user_type").eq("id", otherUserId).single(),
                supabase.from("messages").select("content, message_type").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).single(),
                supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", currentUser.id),
              ])

              return {
                ...conv,
                other_user: profileR.data || undefined,
                last_message: lastMsgR.data?.content,
                last_message_type: lastMsgR.data?.message_type,
                unread_count: unreadR.count || 0,
              } as Conversation
            })
          )
          setConversations(enriched)
        }

        // Process groups
        if (groupMembershipsRes.data) {
          const grps: GroupConversation[] = groupMembershipsRes.data
            .filter((m: any) => m.group_conversations)
            .map((m: any) => {
              const g = m.group_conversations
              return {
                id: g.id,
                name: g.name,
                avatar_url: g.avatar_url,
                group_type: g.group_type || "private",
                last_message: undefined,
                last_sender: undefined,
                last_message_at: g.updated_at,
                unread_count: 0,
                member_count: 0,
              }
            })
          setGroups(grps)
        }

        setLoading(false)
      } catch {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Handle "to" param
  useEffect(() => {
    if (!user || !recipientId || loading) return
    if (recipientId === user.id) return
    if (handledRecipientRef.current === recipientId) return
    handledRecipientRef.current = recipientId

    async function openOrCreate() {
      const existing = conversations.find(c =>
        c.other_user?.id === recipientId ||
        c.participant_1 === recipientId ||
        c.participant_2 === recipientId
      )

      if (existing) {
        setSelectedConversation(existing)
        return
      }

      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          participant_1: user!.id,
          participant_2: recipientId,
          conversation_type: convType || "private",
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (newConv) {
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

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#4B5563] text-sm">Chargement des messages...</p>
      </div>
    )
  }

  // Conversation view
  if (selectedConversation && user) {
    return (
      <ChatConversation
        conversation={selectedConversation}
        userId={user.id}
        onBack={() => {
          setSelectedConversation(null)
          // Refresh conversations list
          supabase
            .from("conversations")
            .select("*")
            .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
            .order("last_message_at", { ascending: false })
            .then(async ({ data: convData }) => {
              if (convData) {
                const enriched = await Promise.all(
                  convData.map(async (conv) => {
                    const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
                    const [profileR, lastMsgR, unreadR] = await Promise.all([
                      supabase.from("profiles").select("id, full_name, avatar_url, user_type").eq("id", otherUserId).single(),
                      supabase.from("messages").select("content, message_type").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).single(),
                      supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("is_read", false).neq("sender_id", user.id),
                    ])
                    return { ...conv, other_user: profileR.data || undefined, last_message: lastMsgR.data?.content, last_message_type: lastMsgR.data?.message_type, unread_count: unreadR.count || 0 } as Conversation
                  })
                )
                setConversations(enriched)
              }
            })
        }}
      />
    )
  }

  // List view
  return (
    <ChatList
      conversations={conversations}
      groups={groups}
      userId={user?.id || ""}
      userType={userType}
      onSelectConversation={setSelectedConversation}
      onSelectGroup={(group) => {
        // TODO: Group conversation view
        router.push(`/messages?group=${group.id}`)
      }}
    />
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FFF6E5] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#1DA1F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#4B5563] text-sm">Chargement...</p>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
