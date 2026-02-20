"use client"

import React, { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search, MoreVertical, Plus, MessageCircle, Briefcase, Users,
  Pin, CheckCheck, Mic, ImageIcon, FileText, Lock, Edit, X, ArrowLeft
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

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
  unread_count?: number
}

interface GroupItem {
  id: string; name: string; avatar_url?: string; group_type: string;
  last_message?: string; last_sender?: string; last_message_at?: string;
  unread_count?: number; member_count?: number
}

type Tab = "private" | "business" | "groups"

interface ChatListProps {
  conversations: ConversationItem[]
  groups: GroupItem[]
  userId: string
  userType: string | null
  onSelectConversation: (c: ConversationItem) => void
  onSelectGroup: (g: GroupItem) => void
  onGroupCreated?: (g: GroupItem) => void
}

export function ChatList({ conversations, groups, userId, userType, onSelectConversation, onSelectGroup, onGroupCreated }: ChatListProps) {
  const [tab, setTab] = useState<Tab>("private")
  const [search, setSearch] = useState("")
  const [showMenu, setShowMenu] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupType, setGroupType] = useState<"private" | "business">("private")
  const [creatingGroup, setCreatingGroup] = useState(false)
  const router = useRouter()

  const priv = conversations.filter(c => c.conversation_type !== "business")
  const biz = conversations.filter(c => c.conversation_type === "business")

  const filtered = (tab === "private" ? priv : biz).filter(c =>
    c.other_user?.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredGroups = groups
    .filter(g => tab === "business" ? (g.group_type === "business" || g.group_type === "cooperative") : (g.group_type === "private" || g.group_type === "community"))
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

  const unreadPriv = priv.reduce((s, c) => s + (c.unread_count || 0), 0)
  const unreadBiz = biz.reduce((s, c) => s + (c.unread_count || 0), 0)

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
    const m: Record<string, string> = { producteur: "Prod.", artisan: "Art.", acheteur: "Ach.", entreprise: "Entr.", cooperative: "Coop.", transformateur: "Trans." }
    return m[t || ""] || ""
  }

  const tabs = [
    { key: "private" as const, label: "Privé", icon: Lock, badge: unreadPriv },
    { key: "business" as const, label: "Business", icon: Briefcase, badge: unreadBiz },
    { key: "groups" as const, label: "Groupes", icon: Users, badge: 0 },
  ]

  async function handleCreateGroup() {
    if (!groupName.trim()) return
    setCreatingGroup(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("group_conversations").insert({
        name: groupName.trim(),
        group_type: groupType,
        created_by: userId,
      }).select().single()

      if (error) throw error
      if (data) {
        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: userId,
          role: "admin",
        })
        const newGroup: GroupItem = {
          id: data.id, name: data.name, group_type: data.group_type,
          avatar_url: data.avatar_url, unread_count: 0, member_count: 1,
        }
        onGroupCreated?.(newGroup)
        toast.success("Groupe créé")
        setShowCreateGroup(false)
        setGroupName("")
        setTab("groups")
      }
    } catch (err) {
      toast.error("Erreur lors de la création")
    }
    setCreatingGroup(false)
  }

  // Create Group Dialog
  if (showCreateGroup) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col">
        <header className="bg-[#1DA1F2] text-white shrink-0 px-4 pt-safe-top">
          <div className="flex items-center gap-3 py-3">
            <button onClick={() => setShowCreateGroup(false)} className="p-1.5 -ml-1.5 rounded-full active:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">Nouveau groupe</h1>
          </div>
        </header>
        <div className="flex-1 p-5 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-[#111b21] mb-2">Nom du groupe</label>
            <input
              value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Ex: Producteurs de cacao..."
              className="w-full h-12 px-4 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1DA1F2] focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111b21] mb-3">Type de groupe</label>
            <div className="flex gap-3">
              {[
                { key: "private" as const, label: "Privé", desc: "Amis & famille", icon: Lock, color: "#1DA1F2" },
                { key: "business" as const, label: "Professionnel", desc: "Business & B2B", icon: Briefcase, color: "#2F7D32" },
              ].map(g => (
                <button key={g.key} onClick={() => setGroupType(g.key)}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all text-left ${groupType === g.key ? "border-[#1DA1F2] bg-[#1DA1F2]/5" : "border-gray-200"}`}>
                  <g.icon className="h-6 w-6 mb-2" style={{ color: g.color }} />
                  <p className="font-semibold text-sm text-[#111b21]">{g.label}</p>
                  <p className="text-xs text-[#667781] mt-0.5">{g.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreateGroup} disabled={!groupName.trim() || creatingGroup}
            className="mt-auto h-12 bg-[#1DA1F2] text-white rounded-xl font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40">
            {creatingGroup ? "Création..." : "Créer le groupe"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* HEADER */}
      <header className="bg-[#1DA1F2] text-white shrink-0 sticky top-0 z-40">
        <div className="px-4 pt-safe-top">
          <div className="flex items-center justify-between py-2.5">
            <h1 className="text-[22px] font-bold tracking-tight">GWA Chat</h1>
            <div className="flex items-center">
              <button onClick={() => router.push("/network")} className="p-2.5 rounded-full active:bg-white/20" aria-label="Nouveau message">
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
                      <button onClick={() => { setShowMenu(false); router.push("/network") }} className="w-full px-4 py-3 active:bg-gray-100 text-sm text-left">Nouveau message</button>
                      <button onClick={() => { setShowMenu(false); setShowCreateGroup(true) }} className="w-full px-4 py-3 active:bg-gray-100 text-sm text-left">Créer un groupe</button>
                      <button onClick={() => { setShowMenu(false); toast.info("Aucun message archivé") }} className="w-full px-4 py-3 active:bg-gray-100 text-sm text-left">Messages archivés</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative pb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              placeholder="Rechercher une conversation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 bg-white/15 border-0 h-10 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
            />
          </div>

          {/* TABS */}
          <div className="flex">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-[13px] font-semibold relative flex items-center justify-center gap-1.5 transition-colors ${
                  tab === t.key ? "text-white" : "text-white/50"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-white text-[#1DA1F2] text-[10px] font-bold rounded-full inline-flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
                {tab === t.key && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-white rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* CONVERSATIONS */}
      <div className="flex-1 overflow-y-auto pb-24">
        {tab === "groups" ? (
          filteredGroups.length > 0 ? (
            filteredGroups.map(g => (
              <button key={g.id} onClick={() => onSelectGroup(g)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-[#f5f6f6] transition-colors text-left border-b border-gray-50">
                <Avatar className="h-[52px] w-[52px]">
                  <AvatarImage src={g.avatar_url || ""} />
                  <AvatarFallback className="bg-[#1DA1F2]/10 text-[#1DA1F2] text-lg font-bold">
                    {g.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-[#111b21] text-[15px] truncate">{g.name}</h3>
                    {g.last_message_at && <span className="text-[12px] text-[#667781] shrink-0 ml-2">{fmtTime(g.last_message_at)}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-[#667781] truncate">
                      {g.last_sender ? `${g.last_sender}: ${g.last_message || ""}` : `${g.member_count || 0} membres`}
                    </p>
                    {(g.unread_count ?? 0) > 0 && (
                      <span className="ml-2 min-w-[20px] h-[20px] px-1 bg-[#25d366] text-white text-[11px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {g.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : <Empty tab="groups" onAction={() => setShowCreateGroup(true)} />
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                  <Pin className="h-3 w-3 text-[#667781]" />
                  <span className="text-[11px] font-semibold text-[#667781] uppercase tracking-wider">Épinglées</span>
                </div>
                {pinned.map(c => <ConvRow key={c.id} c={c} fmtTime={fmtTime} preview={lastMsgPreview}
                  icon={lastMsgIcon} tag={typeTag} onClick={() => onSelectConversation(c)} isBiz={tab === "business"} />)}
              </>
            )}
            {regular.length > 0 ? (
              regular.map(c => <ConvRow key={c.id} c={c} fmtTime={fmtTime} preview={lastMsgPreview}
                icon={lastMsgIcon} tag={typeTag} onClick={() => onSelectConversation(c)} isBiz={tab === "business"} />)
            ) : pinned.length === 0 && (
              <Empty tab={tab} onAction={() => tab === "business" ? router.push("/b2b") : router.push("/network")} />
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => tab === "groups" ? setShowCreateGroup(true) : router.push("/network")}
        className="fixed bottom-24 right-5 w-14 h-14 bg-[#1DA1F2] text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30">
        {tab === "groups" ? <Users className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  )
}

function ConvRow({ c, fmtTime, preview, icon, tag, onClick, isBiz }: {
  c: ConversationItem; fmtTime: (d: string | undefined) => string;
  preview: (c: ConversationItem) => string; icon: (t?: string) => React.ReactNode;
  tag: (t?: string) => string; onClick: () => void; isBiz: boolean
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
        {isBiz && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#2F7D32] rounded-full flex items-center justify-center border-2 border-white">
            <Briefcase className="h-2.5 w-2.5 text-white" />
          </div>
        )}
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
          <span className={`text-[12px] shrink-0 ml-2 ${c.unread_count ? "text-[#1DA1F2] font-semibold" : "text-[#667781]"}`}>
            {c.last_message_at && fmtTime(c.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <CheckCheck className="h-4 w-4 text-[#53bdeb] shrink-0" />
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

function Empty({ tab, onAction }: { tab: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center min-h-[50vh]">
      <div className="w-20 h-20 bg-[#f0f2f5] rounded-full flex items-center justify-center mb-5">
        {tab === "business" ? <Briefcase className="h-9 w-9 text-[#2F7D32]" /> :
         tab === "groups" ? <Users className="h-9 w-9 text-[#1DA1F2]" /> :
         <MessageCircle className="h-9 w-9 text-[#1DA1F2]" />}
      </div>
      <h3 className="text-lg font-semibold text-[#111b21] mb-2">
        {tab === "business" ? "Aucune conversation business" : tab === "groups" ? "Aucun groupe" : "Aucune conversation"}
      </h3>
      <p className="text-[#667781] text-sm max-w-[260px] mb-6 leading-relaxed">
        {tab === "business" ? "Vos négociations et échanges commerciaux B2B apparaîtront ici"
          : tab === "groups" ? "Créez ou rejoignez un groupe pour collaborer"
          : "Contactez un vendeur ou un acheteur depuis le réseau pour démarrer"}
      </p>
      <button onClick={onAction}
        className="px-7 py-3 bg-[#1DA1F2] text-white rounded-full text-sm font-semibold active:scale-95 transition-transform shadow-sm">
        {tab === "business" ? "Explorer le B2B" : tab === "groups" ? "Créer un groupe" : "Trouver des contacts"}
      </button>
    </div>
  )
}
