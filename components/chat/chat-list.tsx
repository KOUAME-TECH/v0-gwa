"use client"

import React, { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search, MoreVertical, Plus, MessageCircle,
  Pin, Check, CheckCheck, Mic, ImageIcon, FileText, Edit
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { GwaMark } from "@/components/brand/gwa-mark"
import { resolveReadReceipt } from "@/lib/chat/read-receipt"

interface ConversationItem {
  id: string
  participant_1: string
  participant_2: string
  conversation_type: string
  last_message_at: string
  is_pinned_1?: boolean
  is_pinned_2?: boolean
  other_user?: { id: string; full_name: string; avatar_url: string; user_type: string }
  last_message?: string
  last_message_type?: string
  last_message_sender_id?: string
  last_message_is_read?: boolean
  unread_count?: number
}

interface GroupItem {
  id: string; name: string; avatar_url?: string; group_type: string;
  last_message?: string; last_sender?: string; last_message_at?: string;
  unread_count?: number; member_count?: number
}

interface ChatListProps {
  conversations: ConversationItem[]
  groups?: GroupItem[]
  userId: string
  userType: string | null
  onSelectConversation: (c: ConversationItem) => void
  onSelectGroup?: (g: GroupItem) => void
  onGroupCreated?: (g: GroupItem) => void
}

export function ChatList({ conversations, userId, onSelectConversation }: ChatListProps) {
  const [search, setSearch] = useState("")
  const [showMenu, setShowMenu] = useState(false)
  const router = useRouter()

  const filtered = conversations.filter(c =>
    c.other_user?.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const isPinned = (c: ConversationItem) => c.participant_1 === userId ? c.is_pinned_1 : c.is_pinned_2
  const pinned = filtered.filter(c => isPinned(c))
  const regular = filtered.filter(c => !isPinned(c))

  const fmtTime = (d: string | undefined) => {
    if (!d) return ""
    const dt = new Date(d)
    const now = new Date()
    const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000)
    if (diff === 0) return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diff === 1) return "Hier"
    if (diff < 7) return dt.toLocaleDateString('fr-FR', { weekday: 'short' })
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  const lastMsgPreview = (c: ConversationItem) => {
    if (c.last_message_type === "voice") return "Message vocal"
    if (c.last_message_type === "image") return "Photo"
    if (c.last_message_type === "file") return "Document"
    return c.last_message || "Nouvelle conversation"
  }

  const lastMsgIcon = (t?: string) => {
    if (t === "voice") return <Mic className="h-3.5 w-3.5 text-[#667781] shrink-0" />
    if (t === "image") return <ImageIcon className="h-3.5 w-3.5 text-[#667781] shrink-0" />
    if (t === "file") return <FileText className="h-3.5 w-3.5 text-[#667781] shrink-0" />
    return null
  }

  const typeTag = (t?: string) => {
    const m: Record<string, string> = { producteur: "Prod.", acheteur: "Ach.", cooperative: "Coop." }
    return m[t || ""] || ""
  }

  return (
    <div className="relative min-h-[100dvh] lg:min-h-0 lg:h-full bg-white flex flex-col">
      {/* HEADER */}
      <header className="bg-[#1F5C2E] text-white shrink-0 sticky top-0 z-40">
        <div className="px-4 pt-safe-top">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <GwaMark size={32} />
              <h1 className="text-[22px] font-bold tracking-tight">GWA Chat</h1>
            </div>
            <div className="flex items-center">
              <button onClick={() => router.push("/recherche")} className="p-2.5 rounded-full active:bg-white/20" aria-label="Nouveau message">
                <Edit className="h-5 w-5" />
              </button>
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 rounded-full active:bg-white/20" aria-label="Menu">
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-2xl z-50 py-2 text-[#111b21]">
                      <button onClick={() => { setShowMenu(false); router.push("/recherche") }} className="w-full px-4 py-3 active:bg-gray-100 text-sm text-left">Trouver un contact</button>
                      <button onClick={() => { setShowMenu(false); toast.info("Aucun message archivé") }} className="w-full px-4 py-3 active:bg-gray-100 text-sm text-left">Messages archivés</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative pb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              placeholder="Rechercher une conversation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 bg-white/15 border-0 h-10 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
            />
          </div>
        </div>
      </header>

      {/* CONVERSATIONS */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-6">
        {pinned.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
              <Pin className="h-3 w-3 text-[#667781]" />
              <span className="text-[11px] font-semibold text-[#667781] uppercase tracking-wider">Épinglées</span>
            </div>
            {pinned.map(c => <ConvRow key={c.id} c={c} userId={userId} fmtTime={fmtTime} preview={lastMsgPreview}
              icon={lastMsgIcon} tag={typeTag} onClick={() => onSelectConversation(c)} />)}
          </>
        )}
        {regular.length > 0 ? (
          regular.map(c => <ConvRow key={c.id} c={c} userId={userId} fmtTime={fmtTime} preview={lastMsgPreview}
            icon={lastMsgIcon} tag={typeTag} onClick={() => onSelectConversation(c)} />)
        ) : pinned.length === 0 && (
          <Empty onAction={() => router.push("/recherche")} />
        )}
      </div>

      {/* FAB */}
      <button onClick={() => router.push("/recherche")}
        className="fixed bottom-24 right-5 lg:bottom-6 lg:right-6 w-14 h-14 bg-[#1F5C2E] text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30 lg:absolute">
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

function ReadReceipt({ c, userId }: { c: ConversationItem; userId: string }) {
  const state = resolveReadReceipt({
    viewerId: userId,
    lastSenderId: c.last_message_sender_id,
    isRead: c.last_message_is_read,
  })
  if (state === "none") return null
  if (state === "read") {
    return <CheckCheck className="h-4 w-4 text-[#C27D10] shrink-0" aria-label="Lu" />
  }
  return <Check className="h-4 w-4 text-[#667781] shrink-0" aria-label="Envoyé" />
}

function ConvRow({ c, userId, fmtTime, preview, icon, tag, onClick }: {
  c: ConversationItem; userId: string; fmtTime: (d: string | undefined) => string;
  preview: (c: ConversationItem) => string; icon: (t?: string) => React.ReactNode;
  tag: (t?: string) => string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-[#f5f6f6] transition-colors text-left border-b border-gray-50">
      <div className="relative shrink-0">
        <Avatar className="h-[52px] w-[52px]">
          <AvatarImage src={c.other_user?.avatar_url || ""} />
          <AvatarFallback className="bg-[#dfe5e7] text-[#54656f] text-lg font-semibold">
            {c.other_user?.full_name?.charAt(0)?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-[#111b21] text-[15px] truncate">{c.other_user?.full_name || "Utilisateur"}</h3>
            {tag(c.other_user?.user_type) && (
              <span className="text-[10px] px-1.5 py-px bg-gray-100 text-[#667781] rounded-full shrink-0 font-medium">
                {tag(c.other_user?.user_type)}
              </span>
            )}
          </div>
          <span className={`text-[12px] shrink-0 ml-2 ${c.unread_count ? "text-[#1F5C2E] font-semibold" : "text-[#667781]"}`}>
            {c.last_message_at && fmtTime(c.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <ReadReceipt c={c} userId={userId} />
            {icon(c.last_message_type)}
            <p className={`text-[13px] truncate ${c.unread_count ? "text-[#111b21] font-medium" : "text-[#667781]"}`}>
              {preview(c)}
            </p>
          </div>
          {(c.unread_count ?? 0) > 0 && (
            <span className="ml-2 min-w-[20px] h-[20px] px-1 bg-[#25d366] text-white text-[11px] font-bold rounded-full flex items-center justify-center shrink-0">
              {c.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function Empty({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center min-h-[50vh]">
      <div className="w-20 h-20 bg-[#f0f2f5] rounded-full flex items-center justify-center mb-5">
        <MessageCircle className="h-9 w-9 text-[#1F5C2E]" />
      </div>
      <h3 className="text-lg font-semibold text-[#111b21] mb-2">Aucune conversation</h3>
      <p className="text-[#667781] text-sm max-w-[260px] mb-6 leading-relaxed">
        Contactez un producteur ou un acheteur depuis un produit ou la recherche pour démarrer une discussion.
      </p>
      <button onClick={onAction}
        className="px-7 py-3 bg-[#1F5C2E] text-white rounded-full text-sm font-semibold active:scale-95 transition-transform shadow-sm">
        Trouver des contacts
      </button>
    </div>
  )
}
