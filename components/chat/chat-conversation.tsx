"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { GwaMark } from "@/components/brand/gwa-mark"
import { CHAT_THEME, CHAT_AFRICA_BG } from "@/lib/chat/theme"
import {
  buildOfferContent,
  parseOfferContent,
  formatOfferAmount,
  type PriceOfferPayload,
} from "@/lib/chat/offer"
import {
  ArrowLeft, Send, Mic, Smile, Phone, Video, MoreVertical,
  Check, CheckCheck, ImageIcon, FileText, X, Trash2, Copy, Reply,
  Pin, BellOff, UserCircle, Flag, Paperclip, Camera, MapPin, HandCoins
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

const userTypeLabels: Record<string, string> = {
  farmer: "Producteur", producteur: "Producteur",
  acheteur: "Acheteur", buyer: "Acheteur", cooperative: "Coopérative",
  business: "Entreprise", entreprise: "Entreprise", transformateur: "Transformateur",
}

export function ChatConversation({ conversation, userId, onBack }: ChatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showAttach, setShowAttach] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [showEmojis, setShowEmojis] = useState(false)
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: string } | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [showOfferSheet, setShowOfferSheet] = useState(false)
  const [offerAmount, setOfferAmount] = useState("")
  const [offerNote, setOfferNote] = useState("")
  const [offerBusy, setOfferBusy] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const recInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const previewAudio = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  const other = conversation.other_user
  const otherName = other?.full_name || "Utilisateur"
  const otherInitial = otherName.charAt(0).toUpperCase()

  const scroll = useCallback(() => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }))
  }, [])

  // Load messages + realtime
  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })

      if (data && mounted) {
        setMessages(data)
        setLoadingMsgs(false)
        scroll()
      }

      // Mark unread as read only when l'utilisateur voit vraiment la conversation
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversation.id)
          .neq("sender_id", userId)
          .eq("is_read", false)
      }
    }
    load()

    // Focus after a tick
    setTimeout(() => inputRef.current?.focus(), 400)

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          scroll()
          if (msg.sender_id !== userId && document.visibilityState === "visible") {
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
        }
      )
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [conversation.id])

  useEffect(() => { scroll() }, [messages.length, scroll])

  // Cleanup recording
  useEffect(() => {
    return () => { if (recInterval.current) clearInterval(recInterval.current) }
  }, [])

  // Send text
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text || sending) return
    setSending(true)
    setNewMessage("")

    const tempId = `tmp-${Date.now()}`
    const temp: Message = {
      id: tempId, conversation_id: conversation.id, sender_id: userId,
      content: text, message_type: "text", is_read: false, is_edited: false,
      created_at: new Date().toISOString(), reply_to_id: replyTo?.id,
    }
    setMessages(prev => [...prev, temp])
    setReplyTo(null)
    scroll()

    try {
      // Verify / refresh auth before sending (évite sessions stale après long séjour admin)
      const { data: refreshed } = await supabase.auth.refreshSession()
      const authUser = refreshed.session?.user
        ?? (await supabase.auth.getUser()).data.user
      if (!authUser) {
        toast.error("Session expirée, reconnectez-vous")
        setSending(false)
        return
      }

      const insertPayload: Record<string, unknown> = {
        conversation_id: conversation.id,
        sender_id: authUser.id,
        content: text,
      }
      if (replyTo?.id) insertPayload.reply_to_id = replyTo.id

      const { data, error } = await supabase.from("messages").insert(insertPayload).select().single()

      if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setNewMessage(text)
        toast.error(error.message || "Erreur d'envoi")
      } else if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m))
        // Push OneSignal + notif in-app pour le destinataire
        void fetch("/api/messages/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            preview: text,
          }),
        })
      }

      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(text)
      toast.error("Erreur réseau")
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // File upload
  async function handleFileUpload(file: File, type: "image" | "file") {
    setShowAttach(false)
    const toastId = toast.loading(type === "image" ? "Envoi de l'image..." : "Envoi du fichier...")

    const ext = file.name.split('.').pop()
    const path = `chat/${conversation.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file)

    let mediaUrl: string | undefined
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
      mediaUrl = publicUrl
    }

    const content = type === "image" ? (mediaUrl ? file.name : `[Photo: ${file.name}]`) : `[${file.name}]`
    await supabase.from("messages").insert({
      conversation_id: conversation.id, sender_id: userId,
      content, message_type: type, media_url: mediaUrl || null,
    })
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id)
    toast.dismiss(toastId)
    toast.success(type === "image" ? "Photo envoyée" : "Fichier envoyé")
  }

  // Voice -- real MediaRecorder
  async function toggleVoice() {
    if (isRecording) {
      // Stop -> preview
      mediaRecorder.current?.stop()
      setIsRecording(false)
      if (recInterval.current) clearInterval(recInterval.current)
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioChunks.current = []
        const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })

        mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data) }
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(audioChunks.current, { type: mr.mimeType })
          const url = URL.createObjectURL(blob)
          const sec = recordSec
          const dur = `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`
          setRecordSec(0)
          if (sec > 0) {
            setAudioPreview({ blob, url, duration: dur })
          }
        }

        mediaRecorder.current = mr
        mr.start()
        setIsRecording(true)
        setRecordSec(0)
        setAudioPreview(null)
        recInterval.current = setInterval(() => setRecordSec(p => p + 1), 1000)
      } catch {
        toast.error("Microphone inaccessible")
      }
    }
  }

  function playPreview() {
    if (!audioPreview) return
    if (isPlayingPreview && previewAudio.current) {
      previewAudio.current.pause()
      previewAudio.current.currentTime = 0
      setIsPlayingPreview(false)
      return
    }
    const audio = new Audio(audioPreview.url)
    previewAudio.current = audio
    setIsPlayingPreview(true)
    audio.onended = () => setIsPlayingPreview(false)
    audio.play()
  }

  async function sendVoiceMessage() {
    if (!audioPreview) return
    if (previewAudio.current) { previewAudio.current.pause(); setIsPlayingPreview(false) }

    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    // Upload audio blob to storage
    const ext = audioPreview.blob.type.includes('webm') ? 'webm' : 'mp4'
    const path = `chat/${conversation.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, audioPreview.blob)

    let mediaUrl: string | undefined
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
      mediaUrl = publicUrl
    }

    await supabase.from("messages").insert({
      conversation_id: conversation.id, sender_id: authUser.id,
      content: `Message vocal (${audioPreview.duration})`,
      message_type: "voice",
      media_url: mediaUrl || null,
    })
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id)

    URL.revokeObjectURL(audioPreview.url)
    setAudioPreview(null)
    toast.success("Message vocal envoye")
  }

  function cancelRecording() {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop()
    }
    setIsRecording(false)
    if (audioPreview) { URL.revokeObjectURL(audioPreview.url); setAudioPreview(null) }
    if (previewAudio.current) { previewAudio.current.pause(); setIsPlayingPreview(false) }
    if (recInterval.current) clearInterval(recInterval.current)
    setRecordSec(0)
  }

  // Menu actions
  function menuAction(a: string) {
    setShowMenu(false)
    if (a === "profile") window.location.href = `/profil/${other?.id}`
    else if (a === "mute") toast.info("Conversation en sourdine")
    else if (a === "pin") toast.info("Conversation épinglée")
    else if (a === "clear") toast.info("Historique effacé")
    else if (a === "report") toast.info("Signalement envoyé")
  }

  async function msgAction(a: string, msg: Message) {
    setSelectedMsg(null)
    if (a === "reply") { setReplyTo(msg); inputRef.current?.focus() }
    else if (a === "copy") { navigator.clipboard.writeText(msg.content); toast.success("Copié") }
    else if (a === "delete" && msg.sender_id === userId) {
      setMessages(prev => prev.filter(m => m.id !== msg.id))
      toast.success("Supprimé")
      await supabase.from("messages").delete().eq("id", msg.id)
    }
  }

  async function sendPriceOffer() {
    const amount = Number.parseInt(offerAmount.replace(/\D/g, ""), 10)
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Indiquez un montant valide")
      return
    }
    setOfferBusy(true)
    try {
      const content = buildOfferContent({
        amount,
        note: offerNote.trim() || undefined,
      })
      const { data: refreshed } = await supabase.auth.refreshSession()
      const authUser =
        refreshed.session?.user ?? (await supabase.auth.getUser()).data.user
      if (!authUser) {
        toast.error("Session expirée")
        setOfferBusy(false)
        return
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: authUser.id,
          content,
          message_type: "offer",
        })
        .select()
        .single()
      if (error) {
        toast.error(error.message || "Envoi impossible")
      } else if (data) {
        setMessages((prev) => [...prev, data])
        scroll()
        void fetch("/api/messages/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            preview: `Offre : ${formatOfferAmount(amount)} FCFA`,
          }),
        })
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation.id)
        setShowOfferSheet(false)
        setOfferAmount("")
        setOfferNote("")
        toast.success("Offre envoyée")
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setOfferBusy(false)
  }

  async function respondToOffer(
    msg: Message,
    offer: PriceOfferPayload,
    status: "accepted" | "declined",
  ) {
    const next = { ...offer, status }
    const content = JSON.stringify(next)
    const { error } = await supabase
      .from("messages")
      .update({ content, is_edited: true })
      .eq("id", msg.id)
    if (error) {
      toast.error("Mise à jour impossible")
      return
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, content, is_edited: true } : m)),
    )
    const replyText =
      status === "accepted"
        ? `J'accepte l'offre de ${formatOfferAmount(offer.amount)} FCFA`
        : `Je refuse l'offre de ${formatOfferAmount(offer.amount)} FCFA`
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      content: replyText,
      message_type: "text",
      reply_to_id: msg.id,
    })
    toast.success(status === "accepted" ? "Offre acceptée" : "Offre refusée")
  }

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  function playVoiceMsg(msg: Message) {
    if (msg.media_url) {
      const a = new Audio(msg.media_url)
      a.play().catch(() => toast.error("Impossible de lire le vocal"))
    }
  }

  function renderContent(msg: Message) {
    if (msg.message_type === "offer") {
      const offer = parseOfferContent(msg.content)
      if (!offer) {
        return <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
      }
      const own = msg.sender_id === userId
      const statusLabel: Record<string, string> = {
        pending: "En attente",
        accepted: "Acceptée",
        declined: "Refusée",
        countered: "Contre-offre",
      }
      return (
        <div className="min-w-[200px] max-w-[260px] space-y-2 py-0.5">
          <div className="flex items-center gap-1.5 text-[#C27D10]">
            <HandCoins className="h-4 w-4 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Offre de prix
            </span>
          </div>
          {offer.productName && (
            <p className="text-[12px] text-[#667781] truncate">{offer.productName}</p>
          )}
          <p className="text-xl font-bold text-[#1F5C2E] tabular-nums">
            {formatOfferAmount(offer.amount)}{" "}
            <span className="text-xs font-medium text-[#667781]">FCFA</span>
          </p>
          {offer.note && (
            <p className="text-[13px] text-[#111b21] leading-snug">{offer.note}</p>
          )}
          <p className="text-[11px] text-[#667781]">{statusLabel[offer.status] || offer.status}</p>
          {!own && offer.status === "pending" && (
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void respondToOffer(msg, offer, "accepted")
                }}
                className="flex-1 h-8 rounded-full bg-[#1F5C2E] text-white text-[12px] font-semibold active:scale-95"
              >
                Accepter
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void respondToOffer(msg, offer, "declined")
                }}
                className="flex-1 h-8 rounded-full border border-[#E5E7EB] text-[12px] font-medium text-[#54656f] active:scale-95"
              >
                Refuser
              </button>
            </div>
          )}
        </div>
      )
    }
    if (msg.message_type === "voice") {
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); playVoiceMsg(msg) }}
          className="flex items-center gap-2 min-w-[180px]">
          <div className="w-8 h-8 bg-[#1F5C2E] rounded-full flex items-center justify-center shrink-0">
            {msg.media_url ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current"><polygon points="6,4 20,12 6,20" /></svg>
            ) : (
              <Mic className="h-4 w-4 text-white" />
            )}
          </div>
          <div className="flex-1 flex items-center gap-0.5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="w-[3px] rounded-full bg-[#1F5C2E]/40" style={{ height: `${4 + Math.sin(i * 0.7) * 8}px` }} />
            ))}
          </div>
          <span className="text-[11px] opacity-60 shrink-0">{msg.content.match(/\((.*?)\)/)?.[1] || "0:00"}</span>
        </button>
      )
    }
    if (msg.message_type === "image") {
      return msg.media_url ? (
        <img src={msg.media_url || "/placeholder.svg"} alt="" className="rounded-lg max-w-[240px] max-h-[280px] object-cover" crossOrigin="anonymous" />
      ) : (
        <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-[#1F5C2E]" /><span className="text-sm">{msg.content}</span></div>
      )
    }
    if (msg.message_type === "file") {
      return (
        <div className="flex items-center gap-2 bg-black/5 rounded-lg p-2.5 min-w-[180px]">
          <FileText className="h-8 w-8 text-[#1F5C2E] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{msg.content.replace(/^\[|\]$/g, '')}</p>
            <p className="text-[11px] opacity-50">Document</p>
          </div>
        </div>
      )
    }
    return <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: CHAT_AFRICA_BG.color }}>
      {/* HEADER */}
      <header className="text-white flex items-center gap-1 px-1 py-1.5 shrink-0 safe-top" style={{ backgroundColor: CHAT_THEME.primary }}>
        <button onClick={onBack} className="p-2 rounded-full active:bg-white/20 transition-colors" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <GwaMark size={28} className="shrink-0 mr-0.5" />

        <button onClick={() => menuAction("profile")} className="flex items-center gap-2.5 flex-1 min-w-0 py-1">
          <Avatar className="h-10 w-10 border-2 border-white/30">
            <AvatarImage src={other?.avatar_url || ""} />
            <AvatarFallback className="bg-white/20 text-white font-bold text-sm">{otherInitial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="font-semibold text-[15px] truncate leading-tight">{otherName}</h2>
            <p className="text-[11px] text-white/70 leading-tight">{userTypeLabels[other?.user_type || ""] || "En ligne"}</p>
          </div>
        </button>

        <button onClick={() => toast.info("Appel audio bientôt disponible")} className="p-2.5 rounded-full active:bg-white/20" aria-label="Appel audio">
          <Phone className="h-5 w-5" />
        </button>
        <button onClick={() => toast.info("Appel vidéo bientôt disponible")} className="p-2.5 rounded-full active:bg-white/20" aria-label="Appel vidéo">
          <Video className="h-5 w-5" />
        </button>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 rounded-full active:bg-white/20" aria-label="Menu">
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-[110]" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-2xl z-[120] py-2 text-[#111]">
                {[
                  { key: "profile", icon: UserCircle, label: "Voir le profil" },
                  { key: "pin", icon: Pin, label: "Épingler la conversation" },
                  { key: "mute", icon: BellOff, label: "Mettre en sourdine" },
                  { key: "clear", icon: Trash2, label: "Effacer les messages" },
                ].map(item => (
                  <button key={item.key} onClick={() => menuAction(item.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-100 text-sm">
                    <item.icon className="h-4 w-4 text-[#6B7280]" />{item.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => menuAction("report")} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-100 text-sm text-red-600">
                  <Flag className="h-4 w-4" />Signaler
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* MESSAGES AREA — fond terre / motif wax Afrique */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        style={{
          backgroundColor: CHAT_AFRICA_BG.color,
          backgroundImage: CHAT_AFRICA_BG.image,
        }}
      >
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-[#1F5C2E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 bg-white/80 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <Send className="h-7 w-7 text-[#1F5C2E]" />
            </div>
            <p className="text-[#5f6368] text-sm font-medium">Envoyez un message pour démarrer la conversation</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const own = msg.sender_id === userId
            const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()
            const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-[#54656f] bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm font-medium">
                      {new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}
                <div className={`flex mb-1 ${own ? "justify-end" : "justify-start"}`}>
                  <div className="relative max-w-[82%]">
                    <button
                      type="button"
                      onClick={() => setSelectedMsg(selectedMsg === msg.id ? null : msg.id)}
                      className={`text-left rounded-2xl shadow-sm px-3 py-1.5 ${
                        own ? "bg-[#d9fdd3] rounded-tr-md" : "bg-white rounded-tl-md"
                      }`}
                    >
                      {replyMsg && (
                        <div className="border-l-[3px] border-[#1F5C2E] pl-2 mb-1 py-0.5 rounded-r-md bg-black/5">
                          <p className="text-[11px] font-semibold text-[#1F5C2E]">
                            {replyMsg.sender_id === userId ? "Vous" : otherName}
                          </p>
                          <p className="text-[11px] text-[#667781] truncate max-w-[200px]">{replyMsg.content}</p>
                        </div>
                      )}
                      <div className="text-[#111b21]">{renderContent(msg)}</div>
                      <div className={`flex items-center gap-1 ${own ? "justify-end" : ""} -mb-0.5 mt-0.5`}>
                        <span className="text-[11px] text-[#667781]">{fmtTime(msg.created_at)}</span>
                        {msg.is_edited && <span className="text-[10px] text-[#667781] italic">modifié</span>}
                        {own && (msg.is_read
                          ? <CheckCheck className="h-[14px] w-[14px] text-[#C27D10]" />
                          : <Check className="h-[14px] w-[14px] text-[#667781]" />
                        )}
                      </div>
                    </button>

                    {selectedMsg === msg.id && (
                      <>
                        <div className="fixed inset-0 z-[105]" onClick={() => setSelectedMsg(null)} />
                        <div className={`absolute ${own ? 'right-0' : 'left-0'} bottom-full mb-1 bg-white rounded-2xl shadow-2xl z-[110] py-1.5 min-w-[150px]`}>
                          <button onClick={() => msgAction("reply", msg)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 active:bg-gray-100 text-sm">
                            <Reply className="h-4 w-4 text-[#6B7280]" />Répondre
                          </button>
                          <button onClick={() => msgAction("copy", msg)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 active:bg-gray-100 text-sm">
                            <Copy className="h-4 w-4 text-[#6B7280]" />Copier
                          </button>
                          {own && (
                            <button onClick={() => msgAction("delete", msg)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 active:bg-gray-100 text-sm text-red-600">
                              <Trash2 className="h-4 w-4" />Supprimer
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

      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="flex-1 border-l-[3px] border-[#1F5C2E] pl-2 min-w-0">
            <p className="text-[11px] font-semibold text-[#1F5C2E]">
              {replyTo.sender_id === userId ? "Vous" : otherName}
            </p>
            <p className="text-[12px] text-[#667781] truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1.5 rounded-full active:bg-gray-100">
            <X className="h-4 w-4 text-[#667781]" />
          </button>
        </div>
      )}

      {/* RECORDING BAR */}
      {isRecording && (
        <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex items-center gap-3 shrink-0">
          <button onClick={cancelRecording} className="p-2 rounded-full active:bg-red-50">
            <Trash2 className="h-5 w-5 text-red-500" />
          </button>
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-red-600 font-mono text-sm font-medium w-10">
            {Math.floor(recordSec / 60)}:{(recordSec % 60).toString().padStart(2, '0')}
          </span>
          <div className="flex-1 flex items-center gap-[2px] overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="w-[2px] bg-red-400/60 rounded-full shrink-0" style={{ height: `${3 + Math.sin((recordSec + i) * 0.5) * 10 + Math.random() * 4}px` }} />
            ))}
          </div>
          <button onClick={toggleVoice} className="w-11 h-11 rounded-full bg-[#1F5C2E] text-white flex items-center justify-center active:scale-90 transition-transform">
            <Check className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* AUDIO PREVIEW BAR */}
      {audioPreview && !isRecording && (
        <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex items-center gap-3 shrink-0">
          <button onClick={cancelRecording} className="p-2 rounded-full active:bg-red-50" aria-label="Annuler">
            <Trash2 className="h-5 w-5 text-red-500" />
          </button>
          <div className="flex-1 bg-[#f0f2f5] rounded-full px-4 py-2.5 flex items-center gap-3">
            <button type="button" onClick={playPreview} className="w-8 h-8 rounded-full bg-[#1F5C2E] flex items-center justify-center shrink-0 active:scale-90 transition-transform" aria-label={isPlayingPreview ? "Pause" : "Ecouter"}>
              {isPlayingPreview ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current"><polygon points="6,4 20,12 6,20" /></svg>
              )}
            </button>
            <div className="flex-1 flex items-center gap-[2px]">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-[3px] bg-[#1F5C2E]/40 rounded-full shrink-0" style={{ height: `${4 + Math.sin(i * 0.4) * 8}px` }} />
              ))}
            </div>
            <span className="text-sm font-mono text-[#667781] shrink-0">{audioPreview.duration}</span>
          </div>
          <button onClick={sendVoiceMessage} className="w-11 h-11 rounded-full bg-[#1F5C2E] text-white flex items-center justify-center active:scale-90 transition-transform" aria-label="Envoyer vocal">
            <Send className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ATTACH OVERLAY */}
      {showAttach && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[108]" onClick={() => setShowAttach(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[109] p-6 pb-8 safe-bottom animate-slideUp">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: ImageIcon, color: "bg-violet-500", label: "Galerie", action: () => { imgRef.current?.click(); setShowAttach(false) } },
                { icon: Camera, color: "bg-pink-500", label: "Caméra", action: () => {
                const camInput = document.createElement('input')
                camInput.type = 'file'
                camInput.accept = 'image/*'
                camInput.capture = 'environment'
                camInput.onchange = (ev) => {
                  const f = (ev.target as HTMLInputElement).files?.[0]
                  if (f) handleFileUpload(f, "image")
                }
                camInput.click()
                setShowAttach(false)
              } },
                { icon: FileText, color: "bg-blue-500", label: "Document", action: () => { fileRef.current?.click(); setShowAttach(false) } },
                { icon: HandCoins, color: "bg-[#C27D10]", label: "Négocier", action: () => { setShowAttach(false); setShowOfferSheet(true) } },
                { icon: MapPin, color: "bg-green-500", label: "Position", action: () => { toast.info("Partage de position bientôt disponible"); setShowAttach(false) } },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="flex flex-col items-center gap-2">
                  <div className={`w-14 h-14 ${item.color} rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs text-[#667781] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* OFFRE DE PRIX — négociation commande */}
      {showOfferSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[108]" onClick={() => setShowOfferSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[109] p-5 pb-8 safe-bottom animate-slideUp">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-1">
              <HandCoins className="h-5 w-5 text-[#C27D10]" />
              <h3 className="text-lg font-semibold text-[#111]">Proposer un prix</h3>
            </div>
            <p className="text-sm text-[#667781] mb-4">
              Négociez avant ou pendant une commande — le vendeur pourra accepter ou refuser.
            </p>
            <label className="text-sm font-medium text-[#111] mb-1.5 block">Montant (FCFA)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="Ex. 15000"
              className="w-full h-12 rounded-xl border border-[#E5E7EB] px-4 text-lg font-semibold tabular-nums mb-3 focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
            />
            <label className="text-sm font-medium text-[#111] mb-1.5 block">Note (optionnel)</label>
            <input
              type="text"
              value={offerNote}
              onChange={(e) => setOfferNote(e.target.value)}
              placeholder="Ex. pour 2 sacs, livraison demain"
              className="w-full h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
            />
            <button
              type="button"
              disabled={offerBusy}
              onClick={() => void sendPriceOffer()}
              className="w-full h-12 rounded-xl bg-[#1F5C2E] text-white font-semibold active:scale-[0.98] disabled:opacity-50"
            >
              {offerBusy ? "Envoi…" : "Envoyer l'offre"}
            </button>
          </div>
        </>
      )}

      {/* INPUT BAR */}
      {!isRecording && !audioPreview && (
        <div className="bg-[#f0f2f5] px-2 py-1.5 shrink-0 safe-bottom">
          <form onSubmit={handleSend} className="flex items-end gap-1.5">
            <div className="flex-1 flex items-center bg-white rounded-[25px] shadow-sm min-h-[48px] px-2">
              <button type="button" onClick={() => setShowEmojis(!showEmojis)}
                className={`p-2 shrink-0 ${showEmojis ? "text-[#1F5C2E]" : "text-[#54656f]"} active:text-[#1F5C2E]`} aria-label="Emojis">
                <Smile className="h-6 w-6" />
              </button>

              <input
                ref={inputRef}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Message"
                className="flex-1 bg-transparent border-0 text-[15px] h-[48px] focus:outline-none placeholder:text-[#8696a0] px-1"
                enterKeyHint="send"
                autoComplete="off"
              />

              <button type="button" onClick={() => setShowAttach(true)}
                className="p-2 text-[#54656f] active:text-[#1F5C2E] shrink-0" aria-label="Joindre un fichier">
                <Paperclip className="h-6 w-6" />
              </button>

              {!newMessage.trim() && (
                <button type="button" onClick={() => imgRef.current?.click()}
                  className="p-2 text-[#54656f] active:text-[#1F5C2E] shrink-0" aria-label="Photo rapide">
                  <Camera className="h-6 w-6" />
                </button>
              )}
            </div>

            {newMessage.trim() ? (
              <button type="submit" disabled={sending}
                className="w-[48px] h-[48px] rounded-full bg-[#1F5C2E] text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-50 shadow-sm"
                aria-label="Envoyer">
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button type="button" onClick={toggleVoice}
                className="w-[48px] h-[48px] rounded-full bg-[#1F5C2E] text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform shadow-sm"
                aria-label="Enregistrement vocal">
                <Mic className="h-5 w-5" />
              </button>
            )}
          </form>

          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "file"); e.target.value = "" }} />
          <input ref={imgRef} type="file" className="hidden" accept="image/*,video/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "image"); e.target.value = "" }} />

          {/* EMOJI PICKER */}
          {showEmojis && (
            <div className="bg-white border-t border-gray-100 px-2 py-2 max-h-[200px] overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {["😀","😂","😍","🥰","😘","😊","🤗","😎","🤔","😏","😭","😢","🥺","😤","🤯","🔥","❤️","💕","👍","👎","🙏","💪","🎉","✨","🌟","⭐","🌍","🌱","🍀","🌸","🍎","🍋","🥑","🌽","🍫","☕","🐔","🐄","🐐","🐟","🚜","🏠","📦","💰","📍","📞","✅","❌","⚡","💡","🎯","📸","🛒","🤝","🎊","👋","🙌","💯","🆗","ℹ️","⏰","🗓️","📝","🔔"].map(emoji => (
                  <button key={emoji} type="button" onClick={() => { setNewMessage(prev => prev + emoji); setShowEmojis(false); inputRef.current?.focus() }}
                    className="text-2xl p-1.5 rounded-lg active:bg-gray-100 hover:bg-gray-50 transition-colors">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
