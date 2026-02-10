"use client"

import React, { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search, Camera, MoreVertical, Plus, MessageCircle, Briefcase, Users,
  Pin, CheckCheck, Mic, ImageIcon, FileText, Lock
} from "lucide-react"
import { useRouter } from "next/navigation"

interface ConversationItem {
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

interface GroupItem {
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

type ActiveTab = "private" | "business" | "groups"

interface ChatListProps {
  conversations: ConversationItem[]
  groups: GroupItem[]
  userId: string
  userType: string | null
  onSelectConversation: (conv: ConversationItem) => void
  onSelectGroup: (group: GroupItem) => void
}

export function ChatList({ conversations, groups, userId, userType, onSelectConversation, onSelectGroup }: ChatListProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("private")
  const [searchTerm, setSearchTerm] = useState("")
  const [showMenu, setShowMenu] = useState(false)
  const router = useRouter()

  const isSeller = ["producteur", "artisan", "transformateur", "cooperative"].includes(userType || "")

  const privateConvs = conversations.filter(c => c.conversation_type !== "business")
  const businessConvs = conversations.filter(c => c.conversation_type === "business")
  const privateGroups = groups.filter(g => g.group_type === "private" || g.group_type === "community")
  const businessGroups = groups.filter(g => g.group_type === "business" || g.group_type === "cooperative")

  const filteredPrivate = privateConvs.filter(c =>
    c.other_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredBusiness = businessConvs.filter(c =>
    c.other_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredGroups = (activeTab === "business" ? businessGroups : privateGroups).filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalUnreadPrivate = privateConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0)
  const totalUnreadBusiness = businessConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const formatTime = (date: string | undefined) => {
    if (!date) return ""
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diff === 1) return "Hier"
    if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  const getLastMsgPreview = (conv: ConversationItem) => {
    if (conv.last_message_type === "voice") return "Message vocal"
    if (conv.last_message_type === "image") return "Photo"
    if (conv.last_message_type === "file") return "Document"
    return conv.last_message || "Nouvelle conversation"
  }

  const getLastMsgIcon = (type?: string) => {
    if (type === "voice") return <Mic className="h-3.5 w-3.5 text-[#4B5563] shrink-0" />
    if (type === "image") return <ImageIcon className="h-3.5 w-3.5 text-[#4B5563] shrink-0" />
    if (type === "file") return <FileText className="h-3.5 w-3.5 text-[#4B5563] shrink-0" />
    return null
  }

  const isPinned = (conv: ConversationItem) => {
    return conv.participant_1 === userId ? conv.is_pinned_1 : conv.is_pinned_2
  }

  const currentConvs = activeTab === "private" ? filteredPrivate : filteredBusiness
  const pinnedConvs = currentConvs.filter(c => isPinned(c))
  const regularConvs = currentConvs.filter(c => !isPinned(c))

  const tabItems = [
    { key: "private" as const, label: "Privé", icon: MessageCircle, badge: totalUnreadPrivate },
    { key: "business" as const, label: "Business", icon: Briefcase, badge: totalUnreadBusiness },
    { key: "groups" as const, label: "Groupes", icon: Users, badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1DA1F2] text-white shrink-0">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">GWA Chat</h1>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-full hover:bg-white/10" onClick={() => router.push("/network")}>
                <Plus className="h-5 w-5" />
              </button>
              <div className="relative">
                <button className="p-2 rounded-full hover:bg-white/10" onClick={() => setShowMenu(!showMenu)}>
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl z-50 py-1 text-[#111827]">
                      <button onClick={() => { setShowMenu(false); router.push("/network") }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                        Nouveau message
                      </button>
                      <button onClick={() => { setShowMenu(false) }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                        Créer un groupe
                      </button>
                      <button onClick={() => { setShowMenu(false) }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                        Messages archivés
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 bg-white/15 border-0 h-9 rounded-lg text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 text-sm"
            />
          </div>

          {/* Tabs */}
          <div className="flex">
            {tabItems.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 text-sm font-medium relative flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === tab.key ? "text-white" : "text-white/60"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-white text-[#1DA1F2] text-[10px] font-bold rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Conversations */}
        {activeTab !== "groups" && (
          <div className="divide-y divide-[#E5E7EB]">
            {/* Pinned */}
            {pinnedConvs.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50">
                  <span className="text-xs font-medium text-[#4B5563] flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Épinglées
                  </span>
                </div>
                {pinnedConvs.map(conv => (
                  <ConversationRow key={conv.id} conv={conv} formatTime={formatTime} getLastMsgPreview={getLastMsgPreview} getLastMsgIcon={getLastMsgIcon} onClick={() => onSelectConversation(conv)} />
                ))}
              </>
            )}

            {/* Regular */}
            {regularConvs.length > 0 ? (
              regularConvs.map(conv => (
                <ConversationRow key={conv.id} conv={conv} formatTime={formatTime} getLastMsgPreview={getLastMsgPreview} getLastMsgIcon={getLastMsgIcon} onClick={() => onSelectConversation(conv)} />
              ))
            ) : pinnedConvs.length === 0 ? (
              <EmptyState
                tab={activeTab}
                onAction={() => router.push(activeTab === "business" ? "/b2b" : "/network")}
              />
            ) : null}
          </div>
        )}

        {/* Groups */}
        {activeTab === "groups" && (
          <div className="divide-y divide-[#E5E7EB]">
            {filteredGroups.length > 0 ? (
              filteredGroups.map(group => (
                <button key={group.id} onClick={() => onSelectGroup(group)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f6f6] active:bg-[#edeef0] transition-colors text-left">
                  <Avatar className="h-14 w-14 shrink-0">
                    {group.avatar_url ? <AvatarImage src={group.avatar_url || "/placeholder.svg"} /> : null}
                    <AvatarFallback className="bg-[#1DA1F2]/10 text-[#1DA1F2] text-lg font-semibold">
                      <Users className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-semibold text-[#111827] truncate">{group.name}</h3>
                      <span className="text-xs text-[#4B5563] shrink-0 ml-2">{group.last_message_at && formatTime(group.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#4B5563] truncate">
                        {group.last_sender ? `${group.last_sender}: ` : ""}{group.last_message || `${group.member_count || 0} membres`}
                      </p>
                      {(group.unread_count ?? 0) > 0 && (
                        <span className="ml-2 min-w-[22px] h-[22px] px-1.5 bg-[#1DA1F2] text-white text-xs font-medium rounded-full flex items-center justify-center shrink-0">
                          {group.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-[#FFF6E5] min-h-[50vh]">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Users className="h-8 w-8 text-[#1DA1F2]" />
                </div>
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Aucun groupe</h3>
                <p className="text-[#4B5563] text-sm max-w-xs mb-4">
                  Créez ou rejoignez un groupe pour collaborer avec d{"'"}autres utilisateurs
                </p>
                <button onClick={() => router.push("/network")}
                  className="px-6 py-2.5 bg-[#1DA1F2] text-white rounded-full text-sm font-medium active:scale-95 transition-transform">
                  Trouver des contacts
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push("/network")}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#1DA1F2] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

// Conversation row component
function ConversationRow({ conv, formatTime, getLastMsgPreview, getLastMsgIcon, onClick }: {
  conv: ConversationItem; formatTime: (d: string | undefined) => string;
  getLastMsgPreview: (c: ConversationItem) => string; getLastMsgIcon: (t?: string) => React.ReactNode; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f6f6] active:bg-[#edeef0] transition-colors text-left">
      <div className="relative">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarImage src={conv.other_user?.avatar_url || ""} />
          <AvatarFallback className="bg-[#1DA1F2]/10 text-[#1DA1F2] text-lg font-semibold">
            {conv.other_user?.full_name?.charAt(0)?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        {conv.conversation_type === "business" && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#2F7D32] rounded-full flex items-center justify-center border-2 border-white">
            <Briefcase className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="font-semibold text-[#111827] truncate">
              {conv.other_user?.full_name || "Utilisateur"}
            </h3>
            {conv.other_user?.user_type && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-[#4B5563] rounded-full shrink-0">
                {conv.other_user.user_type === "producteur" ? "Prod." :
                 conv.other_user.user_type === "artisan" ? "Art." :
                 conv.other_user.user_type === "acheteur" ? "Ach." :
                 conv.other_user.user_type === "entreprise" ? "Entr." :
                 conv.other_user.user_type === "cooperative" ? "Coop." : ""}
              </span>
            )}
          </div>
          <span className={`text-xs shrink-0 ml-2 ${conv.unread_count ? "text-[#1DA1F2] font-medium" : "text-[#4B5563]"}`}>
            {conv.last_message_at && formatTime(conv.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            {getLastMsgIcon(conv.last_message_type)}
            <p className={`text-sm truncate ${conv.unread_count ? "text-[#111827] font-medium" : "text-[#4B5563]"}`}>
              {getLastMsgPreview(conv)}
            </p>
          </div>
          {(conv.unread_count ?? 0) > 0 && (
            <span className="ml-2 min-w-[22px] h-[22px] px-1.5 bg-[#1DA1F2] text-white text-xs font-medium rounded-full flex items-center justify-center shrink-0">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// Empty state component
function EmptyState({ tab, onAction }: { tab: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#FFF6E5] min-h-[50vh]">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5 shadow-sm">
        {tab === "business" ? (
          <Briefcase className="h-10 w-10 text-[#2F7D32]" />
        ) : (
          <MessageCircle className="h-10 w-10 text-[#1DA1F2]" />
        )}
      </div>
      <h3 className="text-xl font-semibold text-[#111827] mb-2">
        {tab === "business" ? "Aucune conversation business" : "Aucune conversation"}
      </h3>
      <p className="text-[#4B5563] text-sm max-w-xs mb-6">
        {tab === "business"
          ? "Vos négociations commerciales et échanges B2B apparaîtront ici"
          : "Contactez un vendeur ou acheteur depuis le marketplace pour démarrer"
        }
      </p>
      <button onClick={onAction}
        className="px-6 py-2.5 bg-[#1DA1F2] text-white rounded-full text-sm font-medium active:scale-95 transition-transform">
        {tab === "business" ? "Explorer le B2B" : "Trouver des contacts"}
      </button>
    </div>
  )
}
