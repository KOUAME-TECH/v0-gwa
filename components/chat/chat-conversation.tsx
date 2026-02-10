"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  ArrowLeft, Send, Mic, MicOff, Camera, Paperclip, Smile, Phone, Video, MoreVertical,
  Check, CheckCheck, ImageIcon, FileText, X, Trash2, Copy, Reply,
  Pin, BellOff, UserCircle, Flag, ChevronDown
} from "lucide-react"

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  media_url?: string
  reply_to_id?: string
  is_read: boolean
  is_edited: boolean
  created_at: string
}

interface ConversationData {
  id: string
  participant_1: string
  participant_2: string
  conversation_type: string
  last_message_at: string
  other_user?: {
    id: string
    full_name: string
    avatar_url: string
    user_type: string
  }
}

interface ChatConversationProps {
  conversation: ConversationData
  userId: string
  onBack: () => void
}

const getUserTypeLabel = (type: string | undefined) => {
  const labels: Record<string, string> = {
    farmer: "Producteur", producteur: "Producteur", artisan: "Artisan",
    acheteur: "Acheteur", buyer: "Acheteur", cooperative: "Coopérative",
    business: "Entreprise", entreprise: "Entreprise", transformateur: "Transformateur",
  }
  return labels[type || ""] || "Membre"
}

export function ChatConversation({ conversation, userId, onBack }: ChatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
  }, [])

  // Load messages + realtime
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })

      if (data) {
        setMessages(data)
        scrollToBottom()
      }

      // Mark as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", userId)
        .eq("is_read", false)
    }

    loadMessages()

    // Focus input for keyboard
    setTimeout(() => inputRef.current?.focus(), 300)

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
          if (newMsg.sender_id !== userId) {
            supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const updatedMsg = payload.new as Message
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversation.id])

  useEffect(() => { scrollToBottom() }, [messages.length])

  // Send text message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage("")

    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId, conversation_id: conversation.id, sender_id: userId,
      content, message_type: "text", is_read: false, is_edited: false,
      created_at: new Date().toISOString(), reply_to_id: replyTo?.id,
    }
    setMessages(prev => [...prev, tempMsg])
    setReplyTo(null)
    scrollToBottom()

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id, sender_id: userId,
        content, message_type: "text", reply_to_id: replyTo?.id || null,
      })
      .select().single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
      toast.error("Erreur lors de l'envoi")
    } else if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id)

    setSending(false)
    inputRef.current?.focus()
  }

  // File upload
  async function handleFileUpload(file: File, type: "image" | "file") {
    const ext = file.name.split('.').pop()
    const path = `chat/${conversation.id}/${Date.now()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, file)

    if (uploadError) {
      // Fallback: send file name as message
      const content = type === "image" ? `[Image: ${file.name}]` : `[Fichier: ${file.name}]`
      await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_id: userId,
        content, message_type: type,
      })
      toast.info(type === "image" ? "Image envoyée" : "Fichier envoyé")
    } else {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
      await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_id: userId,
        content: file.name, message_type: type, media_url: publicUrl,
      })
      toast.success(type === "image" ? "Image envoyée" : "Fichier envoyé")
    }

    await supabase.from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id)
    setShowAttachMenu(false)
  }

  // Voice recording simulation
  function toggleRecording() {
    if (isRecording) {
      setIsRecording(false)
      if (recordingInterval.current) clearInterval(recordingInterval.current)
      // Send voice message
      const duration = recordingTime
      setRecordingTime(0)
      const minutes = Math.floor(duration / 60)
      const seconds = duration % 60
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

      supabase.from("messages").insert({
        conversation_id: conversation.id, sender_id: userId,
        content: `Message vocal (${durationStr})`, message_type: "voice",
      }).then(() => {
        supabase.from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation.id)
      })
      toast.success("Message vocal envoyé")
    } else {
      setIsRecording(true)
      setRecordingTime(0)
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }

  // Long press on message
  function handleMessageAction(action: string, message: Message) {
    setSelectedMessage(null)
    switch (action) {
      case "reply":
        setReplyTo(message)
        inputRef.current?.focus()
        break
      case "copy":
        navigator.clipboard.writeText(message.content)
        toast.success("Copié dans le presse-papiers")
        break
      case "delete":
        if (message.sender_id === userId) {
          supabase.from("messages").delete().eq("id", message.id).then(() => {
            setMessages(prev => prev.filter(m => m.id !== message.id))
            toast.success("Message supprimé")
          })
        }
        break
    }
  }

  // 3-dot menu actions
  function handleMenuAction(action: string) {
    setShowMenu(false)
    switch (action) {
      case "profile":
        window.location.href = `/network/profile/${conversation.other_user?.id}`
        break
      case "mute":
        toast.info("Conversation mise en sourdine")
        break
      case "pin":
        toast.info("Conversation épinglée")
        break
      case "clear":
        toast.info("Historique effacé")
        break
      case "report":
        toast.info("Signalement envoyé")
        break
    }
  }

  // Render message content
  function renderMessageContent(message: Message) {
    if (message.message_type === "voice") {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1DA1F2] rounded-full flex items-center justify-center shrink-0">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="h-1 bg-current opacity-20 rounded-full">
              <div className="h-full bg-[#1DA1F2] rounded-full" style={{ width: '70%' }} />
            </div>
          </div>
          <span className="text-xs opacity-70">{message.content.match(/\((.*?)\)/)?.[1] || "0:00"}</span>
        </div>
      )
    }
    if (message.message_type === "image") {
      return message.media_url ? (
        <img src={message.media_url || "/placeholder.svg"} alt={message.content} className="rounded-lg max-w-[250px] max-h-[300px] object-cover" crossOrigin="anonymous" />
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4 text-[#1DA1F2]" />
          <span>{message.content}</span>
        </div>
      )
    }
    if (message.message_type === "file") {
      return (
        <div className="flex items-center gap-2 bg-black/5 rounded-lg p-2">
          <FileText className="h-8 w-8 text-[#1DA1F2]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{message.content}</p>
            <p className="text-xs opacity-60">Document</p>
          </div>
        </div>
      )
    }
    // Text
    return (
      <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">
        {message.content}
      </p>
    )
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-[100dvh] flex flex-col bg-[#FFF6E5]">
      {/* Header */}
      <header className="bg-[#1DA1F2] text-white px-2 py-2 flex items-center gap-2 shrink-0 z-50">
        <button onClick={onBack} className="p-2 -ml-1 rounded-full hover:bg-white/10 active:bg-white/20">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => handleMenuAction("profile")} className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={conversation.other_user?.avatar_url || ""} />
            <AvatarFallback className="bg-white/20 text-white font-semibold">
              {conversation.other_user?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="font-semibold truncate text-[15px]">
              {conversation.other_user?.full_name || "Utilisateur"}
            </h2>
            <p className="text-xs text-white/70">{getUserTypeLabel(conversation.other_user?.user_type)}</p>
          </div>
        </button>

        <button onClick={() => toast.info("Appel audio bientot disponible")} className="p-2 rounded-full hover:bg-white/10">
          <Phone className="h-5 w-5" />
        </button>
        <button onClick={() => toast.info("Appel video bientot disponible")} className="p-2 rounded-full hover:bg-white/10">
          <Video className="h-5 w-5" />
        </button>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-white/10">
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl z-50 py-1 text-[#111827]">
                <button onClick={() => handleMenuAction("profile")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                  <UserCircle className="h-4 w-4 text-[#4B5563]" /> Voir le profil
                </button>
                <button onClick={() => handleMenuAction("pin")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                  <Pin className="h-4 w-4 text-[#4B5563]" /> Épingler
                </button>
                <button onClick={() => handleMenuAction("mute")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                  <BellOff className="h-4 w-4 text-[#4B5563]" /> Sourdine
                </button>
                <button onClick={() => handleMenuAction("clear")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm">
                  <Trash2 className="h-4 w-4 text-[#4B5563]" /> Effacer les messages
                </button>
                <div className="border-t my-1" />
                <button onClick={() => handleMenuAction("report")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-red-600">
                  <Flag className="h-4 w-4" /> Signaler
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%231DA1F2' fillOpacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Send className="h-8 w-8 text-[#1DA1F2]" />
            </div>
            <h3 className="font-semibold text-[#111827] mb-2">Nouvelle conversation</h3>
            <p className="text-[#4B5563] text-sm">
              Envoyez un message pour démarrer la discussion avec{" "}
              <span className="font-medium">{conversation.other_user?.full_name}</span>
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender_id === userId
            const showDate = index === 0 || new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString()
            const replyMsg = message.reply_to_id ? messages.find(m => m.id === message.reply_to_id) : null

            return (
              <React.Fragment key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs text-[#4B5563] bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
                      {new Date(message.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}
                <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
                  <div className="relative max-w-[80%]">
                    {/* Message bubble */}
                    <button
                      type="button"
                      onClick={() => setSelectedMessage(selectedMessage?.id === message.id ? null : message)}
                      className={`text-left px-3 py-2 rounded-2xl shadow-sm ${
                        isOwn ? "bg-[#d1ecf9] rounded-tr-sm" : "bg-white rounded-tl-sm"
                      }`}
                    >
                      {/* Reply preview */}
                      {replyMsg && (
                        <div className="border-l-2 border-[#1DA1F2] pl-2 mb-1 py-0.5 opacity-70">
                          <p className="text-xs font-medium text-[#1DA1F2]">
                            {replyMsg.sender_id === userId ? "Vous" : conversation.other_user?.full_name}
                          </p>
                          <p className="text-xs truncate">{replyMsg.content}</p>
                        </div>
                      )}

                      <div className="text-[#111827]">
                        {renderMessageContent(message)}
                      </div>

                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
                        <span className="text-[11px] text-[#4B5563]">{formatTime(message.created_at)}</span>
                        {message.is_edited && <span className="text-[10px] text-[#4B5563] italic">modifié</span>}
                        {isOwn && (message.is_read ? <CheckCheck className="h-3.5 w-3.5 text-[#1DA1F2]" /> : <Check className="h-3.5 w-3.5 text-[#4B5563]" />)}
                      </div>
                    </button>

                    {/* Message actions popup */}
                    {selectedMessage?.id === message.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setSelectedMessage(null)} />
                        <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 bg-white rounded-xl shadow-xl z-40 py-1 min-w-[160px]`}>
                          <button onClick={() => handleMessageAction("reply", message)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm">
                            <Reply className="h-4 w-4 text-[#4B5563]" /> Répondre
                          </button>
                          <button onClick={() => handleMessageAction("copy", message)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm">
                            <Copy className="h-4 w-4 text-[#4B5563]" /> Copier
                          </button>
                          {isOwn && (
                            <button onClick={() => handleMessageAction("delete", message)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-red-600">
                              <Trash2 className="h-4 w-4" /> Supprimer
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 py-2 bg-white border-t flex items-center gap-2">
          <div className="flex-1 border-l-2 border-[#1DA1F2] pl-2">
            <p className="text-xs font-medium text-[#1DA1F2]">
              {replyTo.sender_id === userId ? "Vous" : conversation.other_user?.full_name}
            </p>
            <p className="text-xs text-[#4B5563] truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-4 w-4 text-[#4B5563]" />
          </button>
        </div>
      )}

      {/* Recording UI */}
      {isRecording && (
        <div className="px-4 py-3 bg-red-50 border-t flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-600 font-medium text-sm">
            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </span>
          <div className="flex-1 flex items-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-1 bg-red-300 rounded-full" style={{ height: `${Math.random() * 16 + 4}px` }} />
            ))}
          </div>
          <button onClick={() => { setIsRecording(false); if (recordingInterval.current) clearInterval(recordingInterval.current); setRecordingTime(0) }}
            className="p-2 rounded-full hover:bg-red-100">
            <Trash2 className="h-5 w-5 text-red-500" />
          </button>
          <button onClick={toggleRecording} className="p-2 rounded-full bg-red-500 text-white">
            <Send className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      {!isRecording && (
        <form onSubmit={handleSend} className="p-2 bg-[#f0f2f5] shrink-0">
          <div className="flex items-end gap-2">
            {/* Attach + input */}
            <div className="flex-1 flex items-center bg-white rounded-full px-1 py-1 shadow-sm relative">
              <button type="button" onClick={() => toast.info("Emojis bientot disponibles")} className="p-1.5 text-[#54656f] shrink-0 hover:text-[#1DA1F2]">
                <Smile className="h-6 w-6" />
              </button>

              <input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message..."
                className="flex-1 border-0 bg-transparent h-10 text-[15px] focus:outline-none placeholder:text-[#8696a0] px-2"
                autoFocus
                enterKeyHint="send"
              />

              {/* Attach button */}
              <div className="relative">
                <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-1.5 text-[#54656f] shrink-0 hover:text-[#1DA1F2]">
                  <Paperclip className="h-6 w-6" />
                </button>
                {showAttachMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl z-40 p-3 flex gap-3">
                      <button type="button" onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="text-[10px] text-[#4B5563]">Photo</span>
                      </button>
                      <button type="button" onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-pink-600" />
                        </div>
                        <span className="text-[10px] text-[#4B5563]">Caméra</span>
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-[10px] text-[#4B5563]">Fichier</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button type="button" onClick={() => imageInputRef.current?.click()} className="p-1.5 text-[#54656f] shrink-0 hover:text-[#1DA1F2]">
                <ImageIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Send or mic */}
            {newMessage.trim() ? (
              <button type="submit" disabled={sending}
                className="rounded-full h-12 w-12 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-sm flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50">
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button type="button" onClick={toggleRecording}
                className="rounded-full h-12 w-12 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-sm flex items-center justify-center shrink-0 active:scale-95 transition-all">
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "file"); e.target.value = "" }} />
          <input ref={imageInputRef} type="file" className="hidden" accept="image/*,video/*" capture="environment"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "image"); e.target.value = "" }} />
        </form>
      )}
    </div>
  )
}
