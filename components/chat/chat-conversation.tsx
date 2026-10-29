"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
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
import { buildLocationContent, isLocationMessage } from "@/lib/chat/location"
import { ChatLocationBubble } from "@/components/chat/chat-location-bubble"
import { EMOJI_CATEGORIES } from "@/lib/chat/emojis"
import {
  ORDER_FLOW,
  ORDER_STATUS_LABELS,
  canBuyerConfirmReception,
  normalizeOrderStatus,
  orderFlowIndex,
} from "@/lib/orders/escrow-flow"
import {
  ArrowLeft, Send, Mic, Smile, Phone, Video, MoreVertical,
  Check, CheckCheck, ImageIcon, FileText, X, Trash2, Copy, Reply,
  Pin, BellOff, UserCircle, Flag, Paperclip, Camera, MapPin, HandCoins,
  Sparkles,
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
  offer_accepted_by?: string | null
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

interface NegotiatedOrder {
  id: string
  order_number: string
  status: string
  payment_status: string | null
  escrow_status: string | null
  source_offer_message_id: string
  buyer_id: string
}

interface ChatConversationProps {
  conversation: ConversationData
  userId: string
  initialProductId?: string
  initialAmount?: number
  initialQuantity?: number
  openNegotiation?: boolean
  onBack: () => void
}

const userTypeLabels: Record<string, string> = {
  farmer: "Producteur", producteur: "Producteur",
  acheteur: "Acheteur", buyer: "Acheteur", cooperative: "Coopérative",
  business: "Entreprise", entreprise: "Entreprise", transformateur: "Transformateur",
}

function normalizeChatOrderStatus(status: string) {
  const normalized = normalizeOrderStatus(status)
  const aliases: Record<string, string> = {
    en_preparation: "processing",
    en_transit: "shipped",
    en_route: "shipped",
    confirme: "confirmed",
    livre: "delivered",
    paiement_escrow: "confirmed",
  }
  return aliases[normalized] || normalized
}

function getChatUploadPath(conversationId: string, fileName: string) {
  const ext = fileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin"
  return `chat/${conversationId}/${Date.now()}.${ext}`
}

export function ChatConversation({
  conversation,
  userId,
  initialProductId,
  initialAmount,
  initialQuantity,
  openNegotiation,
  onBack,
}: ChatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [negotiatedOrders, setNegotiatedOrders] = useState<Record<string, NegotiatedOrder>>({})
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null)
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showAttach, setShowAttach] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [showEmojis, setShowEmojis] = useState(false)
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0]?.id ?? "smileys")
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: string } | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [showOfferSheet, setShowOfferSheet] = useState(false)
  const [offerAmount, setOfferAmount] = useState("")
  const [offerNote, setOfferNote] = useState("")
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerProducts, setOfferProducts] = useState<
    { id: string; name: string; price: number; unit?: string }[]
  >([])
  const [offerProductId, setOfferProductId] = useState<string>("")
  const [offerQuantity, setOfferQuantity] = useState("1")
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null)
  const [showYelly, setShowYelly] = useState(false)
  const [yellyQuestion, setYellyQuestion] = useState("")
  const [yellyReply, setYellyReply] = useState("")
  const [yellyConversationId, setYellyConversationId] = useState<string | null>(null)
  const [yellyBusy, setYellyBusy] = useState(false)
  const [yellyError, setYellyError] = useState("")
  const [muted, setMuted] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [liveCameraOpen, setLiveCameraOpen] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSent = useRef(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const recInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const previewAudio = useRef<HTMLAudioElement | null>(null)
  const autoNegotiationKey = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const other = conversation.other_user
  const otherName = other?.full_name || "Utilisateur"
  const otherInitial = otherName.charAt(0).toUpperCase()
  const prefsKey = `gwa-chat-prefs:${userId}:${conversation.id}`
  const acceptedOfferIds = useMemo(
    () =>
      messages
        .filter((message) => {
          if (message.message_type !== "offer") return false
          return parseOfferContent(message.content)?.status === "accepted"
        })
        .map((message) => message.id),
    [messages],
  )

  const refreshNegotiatedOrders = useCallback(async () => {
    if (acceptedOfferIds.length === 0) {
      setNegotiatedOrders({})
      return
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, escrow_status, source_offer_message_id, buyer_id")
      .in("source_offer_message_id", acceptedOfferIds)

    if (error) return
    const nextOrders: Record<string, NegotiatedOrder> = {}
    for (const order of (data || []) as NegotiatedOrder[]) {
      nextOrders[order.source_offer_message_id] = order
    }
    setNegotiatedOrders(nextOrders)
  }, [acceptedOfferIds, supabase])

  useEffect(() => {
    void refreshNegotiatedOrders()
    if (acceptedOfferIds.length === 0) return
    const interval = window.setInterval(() => void refreshNegotiatedOrders(), 20_000)
    return () => window.clearInterval(interval)
  }, [acceptedOfferIds.length, refreshNegotiatedOrders])

  useEffect(() => {
    let prefs: { muted?: boolean; pinned?: boolean } = {}
    try {
      const raw = localStorage.getItem(prefsKey)
      if (raw) prefs = JSON.parse(raw) as { muted?: boolean; pinned?: boolean }
    } catch {
      /* ignore */
    }
    const timeout = window.setTimeout(() => {
      setMuted(!!prefs.muted)
      setPinned(!!prefs.pinned)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [prefsKey])

  function savePrefs(next: { muted?: boolean; pinned?: boolean }) {
    const value = {
      muted: next.muted ?? muted,
      pinned: next.pinned ?? pinned,
    }
    setMuted(value.muted)
    setPinned(value.pinned)
    try {
      localStorage.setItem(prefsKey, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }

  function stopLiveCamera() {
    liveStreamRef.current?.getTracks().forEach((t) => t.stop())
    liveStreamRef.current = null
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null
    setLiveCameraOpen(false)
  }

  function fallbackNativeCameraInput() {
    // Délai: laisse l'overlay se fermer avant d'ouvrir le picker (iOS)
    window.setTimeout(() => {
      if (camRef.current) {
        camRef.current.click()
        return
      }
      const camInput = document.createElement("input")
      camInput.type = "file"
      camInput.accept = "image/*"
      camInput.setAttribute("capture", "environment")
      camInput.onchange = () => {
        const f = camInput.files?.[0]
        if (f) void handleFileUpload(f, "image")
      }
      camInput.click()
    }, 120)
  }

  async function openCameraCapture() {
    setShowAttach(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackNativeCameraInput()
      return
    }
    setCameraBusy(true)
    try {
      liveStreamRef.current?.getTracks().forEach((t) => t.stop())
      liveStreamRef.current = null
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      liveStreamRef.current = stream
      setLiveCameraOpen(true)
      // Attacher le flux après le rendu du <video>
      requestAnimationFrame(() => {
        const video = liveVideoRef.current
        if (!video) return
        video.srcObject = stream
        void video.play().catch(() => {
          /* autoplay peut échouer un tick */
        })
      })
    } catch {
      setLiveCameraOpen(false)
      fallbackNativeCameraInput()
    } finally {
      setCameraBusy(false)
    }
  }

  function captureLivePhoto() {
    const video = liveVideoRef.current
    if (!video || !video.videoWidth) {
      toast.error("Caméra pas prête")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Photo impossible")
          return
        }
        const file = new File([blob], `chat-${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        stopLiveCamera()
        void handleFileUpload(file, "image")
      },
      "image/jpeg",
      0.92,
    )
  }

  useEffect(() => {
    return () => {
      liveStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!liveCameraOpen) return
    const video = liveVideoRef.current
    const stream = liveStreamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => {
      /* ignore */
    })
  }, [liveCameraOpen])

  const scroll = useCallback(() => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }))
  }, [])

  // Load messages + realtime
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })

        if (!mounted) return
        if (error) {
          setLoadError(true)
          toast.error("Impossible de charger les messages")
        } else {
          setLoadError(false)
          setMessages(data || [])
          scroll()
        }
        setLoadedConversationId(conversation.id)

        // Mark unread as read only when l'utilisateur voit vraiment la conversation
        if (!error && typeof document !== "undefined" && document.visibilityState === "visible") {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("conversation_id", conversation.id)
            .neq("sender_id", userId)
            .eq("is_read", false)
        }
      } catch {
        if (mounted) {
          setLoadError(true)
          setLoadedConversationId(conversation.id)
          toast.error("Impossible de charger les messages")
        }
      }
    }
    void load()

    // Focus after a tick
    setTimeout(() => inputRef.current?.focus(), 400)

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload: { new: Message }) => {
          const msg = payload.new
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          scroll()
          if (msg.sender_id !== userId && document.visibilityState === "visible") {
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload: { new: Message }) => {
          const msg = payload.new
          setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
        }
      )
      .on("broadcast", { event: "typing" }, (msg: { payload?: { userId?: string } }) => {
        const p = msg.payload
        if (p?.userId && p.userId !== userId) {
          setPeerTyping(true)
          if (typingTimer.current) clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => setPeerTyping(false), 2200)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      mounted = false
      channelRef.current = null
      if (typingTimer.current) clearTimeout(typingTimer.current)
      supabase.removeChannel(channel)
    }
  }, [conversation.id, reloadAttempt, scroll, supabase, userId])

  const signalTyping = () => {
    const now = Date.now()
    if (now - lastTypingSent.current < 1200) return
    lastTypingSent.current = now
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId },
    })
  }

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

  async function handleFileUpload(file: File, type: "image" | "file") {
    setShowAttach(false)
    const toastId = toast.loading(type === "image" ? "Envoi de l'image..." : "Envoi du fichier...")

    const path = getChatUploadPath(conversation.id, file.name)
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file)

    if (upErr) {
      toast.dismiss(toastId)
      toast.error("Envoi échoué, réessayez")
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-media").getPublicUrl(path)

    const content = type === "image" ? file.name : `[${file.name}]`
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      content,
      message_type: type,
      media_url: publicUrl,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id)
    toast.dismiss(toastId)
    if (msgErr) toast.error(msgErr.message)
    else toast.success(type === "image" ? "Photo envoyée" : "Fichier envoyé")
  }

  async function shareLocation() {
    setShowAttach(false)
    if (!navigator.geolocation) {
      toast.error("Localisation indisponible")
      return
    }
    const toastId = toast.loading("On trouve ta position…")
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        let addressLine = ""
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`,
          )
          const data = await res.json().catch(() => ({}))
          if (data.address || data.label) {
            addressLine = String(data.address || data.label)
          }
        } catch {
          /* coords suffisent */
        }
        const content = buildLocationContent({
          lat: latitude,
          lon: longitude,
          address: addressLine || undefined,
          accuracyM: Number.isFinite(accuracy) ? accuracy : undefined,
        })
        const { error } = await supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_id: userId,
          content,
          message_type: "location",
        })
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation.id)
        toast.dismiss(toastId)
        if (error) {
          // Fallback si le type location est refusé côté DB
          const maps = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
          const textContent = ["📍 Ma position", addressLine || null, maps]
            .filter(Boolean)
            .join("\n")
          const { error: e2 } = await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: userId,
            content: textContent,
            message_type: "text",
          })
          if (e2) toast.error("Envoi impossible")
          else toast.success("Position envoyée")
          return
        }
        toast.success("Position envoyée")
      },
      () => {
        toast.dismiss(toastId)
        toast.error("Autorise la localisation")
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }

  const openOfferSheet = useCallback(async (
    counter?: { message: Message; offer: PriceOfferPayload },
    context?: { productId?: string; amount?: number; quantity?: number },
  ) => {
    setShowAttach(false)
    setShowOfferSheet(true)
    setCounterOfferId(counter?.message.id ?? null)
    setOfferNote("")
    setOfferQuantity(String(counter?.offer.quantity ?? context?.quantity ?? initialQuantity ?? 1))
    if (counter) setOfferAmount(String(counter.offer.amount))
    else {
      const presetAmount = context?.amount ?? initialAmount
      if (presetAmount && presetAmount > 0) {
        setOfferAmount(String(Math.round(presetAmount)))
      }
    }
    // Produits actifs des deux participants (acheteur négocie sur produit vendeur)
    const sellerIds = [other?.id, userId].filter(Boolean) as string[]
    const { data } = await supabase
      .from("products")
      .select("id, name, price, unit, seller_id")
      .in("seller_id", sellerIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(30)
    const list = (data || []) as {
      id: string
      name: string
      price: number
      unit?: string
      seller_id?: string
    }[]
    // Préférer les produits de l'interlocuteur (cas acheteur → vendeur)
    const preferred = list.filter((p) => p.seller_id === other?.id)
    const rest = list.filter((p) => p.seller_id !== other?.id)
    const ordered = preferred.length > 0 ? [...preferred, ...rest] : list
    setOfferProducts(ordered)
    const preferredProductId = counter?.offer.productId || context?.productId || initialProductId
    const selected = ordered.find((p) => p.id === preferredProductId) || ordered[0]
    if (selected) {
      setOfferProductId(selected.id)
      if (!counter && !(context?.amount ?? initialAmount)) {
        setOfferAmount(String(Math.round(selected.price)))
      }
    }
  }, [initialAmount, initialProductId, initialQuantity, other?.id, supabase, userId])

  useEffect(() => {
    if (
      !openNegotiation ||
      !initialProductId ||
      loadedConversationId !== conversation.id
    ) {
      return
    }
    const key = `${conversation.id}:${initialProductId}`
    if (autoNegotiationKey.current === key) return
    autoNegotiationKey.current = key
    void openOfferSheet(undefined, {
      productId: initialProductId,
      amount: initialAmount,
      quantity: initialQuantity,
    })
  }, [
    conversation.id,
    initialAmount,
    initialProductId,
    initialQuantity,
    loadedConversationId,
    openNegotiation,
    openOfferSheet,
  ])

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
      } catch (err) {
        console.warn("[chat] mic", err)
        toast.error("Micro inaccessible — autorise le micro dans le navigateur")
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
    if (upErr) {
      toast.error("Envoi vocal échoué, réessayez")
      return
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-media").getPublicUrl(path)

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: authUser.id,
      content: `Message vocal (${audioPreview.duration})`,
      message_type: "voice",
      media_url: publicUrl,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id)

    URL.revokeObjectURL(audioPreview.url)
    setAudioPreview(null)
    if (msgErr) toast.error(msgErr.message)
    else toast.success("Message vocal envoyé")
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

  // Menu actions — comportement réel (prefs locales + actions)
  async function menuAction(a: string) {
    setShowMenu(false)
    if (a === "profile") {
      if (other?.id) window.location.href = `/profil/${other.id}`
      return
    }
    if (a === "mute") {
      savePrefs({ muted: !muted })
      toast.success(muted ? "Notifications réactivées" : "Conversation en sourdine")
      return
    }
    if (a === "pin") {
      savePrefs({ pinned: !pinned })
      // Persister côté DB si colonnes présentes
      const col =
        conversation.participant_1 === userId ? "is_pinned_1" : "is_pinned_2"
      await supabase
        .from("conversations")
        .update({ [col]: !pinned })
        .eq("id", conversation.id)
      toast.success(pinned ? "Conversation désépinglée" : "Conversation épinglée")
      return
    }
    if (a === "clear") {
      const ok = window.confirm("Effacer tous tes messages de cette conversation ?")
      if (!ok) return
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversation.id)
        .eq("sender_id", userId)
      if (error) toast.error("Impossible d'effacer")
      else {
        setMessages((prev) => prev.filter((message) => message.sender_id !== userId))
        toast.success("Tes messages ont été effacés")
      }
      return
    }
    if (a === "report") {
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: "⚠️ Signalement : comportement inapproprié signalé à GWA.",
        message_type: "text",
      })
      toast.success("Signalement enregistré")
    }
  }

  async function callOther(kind: "audio" | "video") {
    // WhatsApp-like : tenter tel: si numéro accessible, sinon message d'appel
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", other?.id || "")
        .maybeSingle()
      if (kind === "audio" && p?.phone) {
        window.location.href = `tel:${p.phone}`
        return
      }
    } catch {
      /* PII peut être restreint */
    }
    const label = kind === "audio" ? "Appel audio" : "Appel vidéo"
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      content: `📞 ${label} demandé. Rappelez via téléphone ou continuez ici.`,
      message_type: "text",
    })
    toast.info(
      kind === "audio"
        ? "Message d'appel envoyé"
        : "Appel vidéo bientôt disponible. Message envoyé.",
    )
  }

  async function msgAction(a: string, msg: Message) {
    setSelectedMsg(null)
    if (a === "reply") { setReplyTo(msg); inputRef.current?.focus() }
    else if (a === "copy") { navigator.clipboard.writeText(msg.content); toast.success("Copié") }
    else if (a === "delete" && msg.sender_id === userId) {
      const { error } = await supabase.from("messages").delete().eq("id", msg.id)
      if (error) {
        toast.error("Impossible de supprimer ce message")
      } else {
        setMessages((prev) => prev.filter((message) => message.id !== msg.id))
        toast.success("Message supprimé")
      }
    }
  }

  async function sendPriceOffer() {
    const amount = Number.parseInt(offerAmount.replace(/\D/g, ""), 10)
    const quantity = Number.parseInt(offerQuantity, 10)
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error("Indiquez un montant valide")
      return
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Indiquez une quantité valide")
      return
    }
    setOfferBusy(true)
    try {
      const selected = offerProducts.find((p) => p.id === offerProductId)
      const content = buildOfferContent({
        amount,
        quantity,
        unit: selected?.unit,
        note: offerNote.trim() || undefined,
        productId: offerProductId || undefined,
        productName: selected?.name,
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
          reply_to_id: counterOfferId || undefined,
        })
        .select()
        .single()
      if (error) {
        toast.error(error.message || "Envoi impossible")
      } else if (data) {
        setMessages((prev) => [...prev, data])
        scroll()
        if (counterOfferId) {
          const response = await fetch("/api/messages/offer-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: counterOfferId, status: "countered" }),
          })
          const result = await response.json().catch(() => ({}))
          if (response.ok && result.message) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === counterOfferId ? result.message : message,
              ),
            )
          } else {
            toast.error("Contre-offre envoyée, mais l'offre précédente reste ouverte")
          }
        }
        void fetch("/api/messages/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            preview: muted
              ? "Nouvelle offre"
              : `Offre : ${formatOfferAmount(amount)} FCFA`,
          }),
        })
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation.id)
        setShowOfferSheet(false)
        setCounterOfferId(null)
        setOfferAmount("")
        setOfferNote("")
        setOfferQuantity("1")
        toast.success(counterOfferId ? "Contre-offre envoyée" : "Offre envoyée")
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
    try {
      const response = await fetch("/api/messages/offer-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.message) {
        toast.error(result.error || "Mise à jour impossible")
        return
      }
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? result.message : m)))
      const replyText =
        status === "accepted"
          ? `J'accepte l'offre de ${formatOfferAmount(offer.amount)} FCFA`
          : `Je refuse l'offre de ${formatOfferAmount(offer.amount)} FCFA`
      const { error: replyError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: replyText,
        message_type: "text",
        reply_to_id: msg.id,
      })
      if (replyError) {
        toast.error("Réponse enregistrée, mais le message de confirmation n'a pas été envoyé")
      }

      if (status === "accepted") {
        toast.success("Offre acceptée — passez commande depuis cette offre.")
      } else {
        toast.success("Offre refusée")
      }
    } catch {
      toast.error("Erreur réseau, réessayez")
    }
  }

  async function createOrderFromOffer(messageId: string, quantity = 1) {
    if (creatingOrderId) return
    setCreatingOrderId(messageId)
    const toastId = toast.loading("Création de la commande au prix négocié…")
    try {
      const response = await fetch("/api/orders/from-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, quantity }),
      })
      const data = await response.json().catch(() => ({}))
      toast.dismiss(toastId)
      if (!response.ok) {
        toast.error(data.error || "Offre acceptée, commande à finaliser")
      } else {
        toast.success("Commande créée au prix négocié")
        await refreshNegotiatedOrders()
      }
    } catch {
      toast.dismiss(toastId)
      toast.error("Erreur réseau commande")
    } finally {
      setCreatingOrderId(null)
    }
  }

  async function confirmOrderReceipt(order: NegotiatedOrder) {
    if (confirmingOrderId) return
    setConfirmingOrderId(order.id)
    try {
      const response = await fetch(`/api/orders/${order.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(result.error || "Confirmation de réception impossible")
        return
      }
      setNegotiatedOrders((current) => ({
        ...current,
        [order.source_offer_message_id]: {
          ...order,
          status: "delivered",
          escrow_status: "released",
        },
      }))
      toast.success("Réception confirmée. Merci !")
      await refreshNegotiatedOrders()
    } catch {
      toast.error("Erreur réseau, réessayez")
    } finally {
      setConfirmingOrderId(null)
    }
  }

  async function askYelly(e: React.FormEvent) {
    e.preventDefault()
    const question = yellyQuestion.trim()
    if (!question || yellyBusy) return

    const currentOfferMessage = [...messages].reverse().find((message) => {
      const offer = message.message_type === "offer"
        ? parseOfferContent(message.content)
        : null
      return offer?.status === "pending"
    })
    const currentOffer = currentOfferMessage
      ? parseOfferContent(currentOfferMessage.content)
      : null
    const productDetails = currentOffer
      ? `Produit : ${currentOffer.productName || "non précisé"}. Offre : ${formatOfferAmount(currentOffer.amount)} FCFA.`
      : "Aucune offre de prix n'est encore en cours."
    const message = `Aide-moi à négocier avec tact sur GWA. ${productDetails} Ma question : ${question}`.slice(0, 800)

    setYellyBusy(true)
    setYellyError("")
    setYellyReply("")
    try {
      const response = await fetch("/api/yelly/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page: "/messages",
          conversationId: yellyConversationId,
          context: currentOffer?.productId
            ? { productId: currentOffer.productId }
            : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setYellyError(data.error || "Yelly est indisponible pour le moment.")
      } else {
        if (typeof data.conversationId === "string") {
          setYellyConversationId(data.conversationId)
        }
        setYellyReply(String(data.reply || "Je n'ai pas pu préparer de conseil."))
      }
    } catch {
      setYellyError("Réseau indisponible. Réessayez.")
    } finally {
      setYellyBusy(false)
    }
  }

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  function playVoiceMsg(msg: Message) {
    if (msg.media_url) {
      const a = new Audio(msg.media_url)
      a.play().catch(() => toast.error("Impossible de lire le vocal"))
    }
  }

  function handleAttachmentAction(action: "gallery" | "camera" | "document" | "offer" | "location") {
    if (action === "gallery") {
      imgRef.current?.click()
      setShowAttach(false)
    } else if (action === "camera") {
      void openCameraCapture()
    } else if (action === "document") {
      fileRef.current?.click()
      setShowAttach(false)
    } else if (action === "offer") {
      void openOfferSheet()
    } else {
      void shareLocation()
    }
  }

  function renderContent(msg: Message) {
    if (msg.message_type === "location" || isLocationMessage(msg.message_type, msg.content)) {
      return <ChatLocationBubble content={msg.content} messageType={msg.message_type} />
    }
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
      const negotiatedOrder = negotiatedOrders[msg.id]
      const orderStatus = negotiatedOrder
        ? normalizeChatOrderStatus(negotiatedOrder.status)
        : null
      const orderProgress = negotiatedOrder ? orderFlowIndex(orderStatus || "") : -1
      const orderSteps = [
        { status: "pending", label: "Commande créée" },
        { status: "confirmed", label: "Confirmée" },
        { status: "processing", label: "En préparation" },
        { status: "shipped", label: "Expédiée" },
        { status: "delivered", label: "Livrée" },
      ]
      return (
        <div className="min-w-0 max-w-full space-y-2 py-0.5 sm:min-w-[200px] sm:max-w-[260px]">
          <div className="flex items-center gap-1.5 text-[#C27D10]">
            <HandCoins className="h-4 w-4 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Offre de prix
            </span>
          </div>
          {offer.productName && (
            <p className="text-[12px] text-[#667781] truncate">{offer.productName}</p>
          )}
          {offer.quantity && (
            <p className="text-[12px] text-[#667781]">
              Quantité : {offer.quantity}{offer.unit ? ` ${offer.unit}` : ""}
            </p>
          )}
          <p className="text-xl font-bold text-[#1F5C2E] tabular-nums">
            <span className="sr-only">Prix unitaire : </span>
            {formatOfferAmount(offer.amount)}{" "}
            <span className="text-xs font-medium text-[#667781]">FCFA</span>
          </p>
          {offer.quantity && (
            <p className="text-[11px] text-[#667781]">
              Total indicatif : {formatOfferAmount(offer.amount * offer.quantity)} FCFA
            </p>
          )}
          {offer.note && (
            <p className="text-[13px] text-[#111b21] leading-snug">{offer.note}</p>
          )}
          <p className="text-[11px] text-[#667781]">{statusLabel[offer.status] || offer.status}</p>
          {!own && offer.status === "pending" && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void respondToOffer(msg, offer, "accepted")
                }}
                className="min-w-[72px] flex-1 h-8 rounded-full bg-[#1F5C2E] text-white text-[12px] font-semibold active:scale-95"
              >
                Accepter
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void openOfferSheet({ message: msg, offer })
                }}
                className="min-w-[72px] flex-1 h-8 rounded-full border border-[#1F5C2E]/30 text-[12px] font-medium text-[#1F5C2E] active:scale-95"
              >
                Contre-offre
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void respondToOffer(msg, offer, "declined")
                }}
                className="min-w-[72px] flex-1 h-8 rounded-full border border-[#E5E7EB] text-[12px] font-medium text-[#54656f] active:scale-95"
              >
                Refuser
              </button>
            </div>
          )}
          {offer.status === "accepted" && !negotiatedOrder && msg.offer_accepted_by === userId && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void createOrderFromOffer(msg.id, offer.quantity || 1)
              }}
              disabled={creatingOrderId === msg.id}
              className="w-full rounded-full bg-[#1F5C2E] px-3 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              {creatingOrderId === msg.id ? "Création…" : "Passer commande"}
            </button>
          )}
          {offer.status === "accepted" && !negotiatedOrder && msg.offer_accepted_by !== userId && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              Accord trouvé. La personne qui a accepté peut maintenant passer commande.
            </p>
          )}
          {negotiatedOrder && (
            <section className="space-y-2 rounded-xl border border-[#1F5C2E]/15 bg-[#F4F8F3] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1F5C2E]">
                    Suivi de commande
                  </p>
                  <p className="text-xs font-semibold text-[#111b21]">
                    {negotiatedOrder.order_number || "Commande créée"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#1F5C2E]">
                  {orderStatus === "pending"
                    ? "Commande créée"
                    : ORDER_STATUS_LABELS[orderStatus || ""] || orderStatus || "En cours"}
                </span>
              </div>
              <ol className="space-y-1">
                {orderSteps.map((step, index) => {
                  const stepStatus = ORDER_FLOW[index]
                  const complete = orderProgress >= index
                  return (
                    <li key={step.status} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                          complete ? "bg-[#1F5C2E] text-white" : "bg-white text-[#667781]"
                        }`}
                      >
                        {complete ? "✓" : index + 1}
                      </span>
                      <span className={complete ? "font-medium text-[#1F5C2E]" : "text-[#667781]"}>
                        {step.label}
                      </span>
                      <span className="sr-only">{stepStatus}</span>
                    </li>
                  )
                })}
              </ol>
              {orderStatus === "cancelled" || orderStatus === "disputed" ? (
                <p className="text-[11px] text-amber-900">
                  {ORDER_STATUS_LABELS[orderStatus] || "La commande est interrompue."}
                </p>
              ) : null}
              {canBuyerConfirmReception({
                isSeller: negotiatedOrder.buyer_id !== userId,
                payment_status: negotiatedOrder.payment_status,
                escrow_status: negotiatedOrder.escrow_status as "pending" | "held" | "released" | "frozen" | null,
                status: orderStatus,
              }) && (
                <button
                  type="button"
                  disabled={confirmingOrderId === negotiatedOrder.id}
                  onClick={(event) => {
                    event.stopPropagation()
                    void confirmOrderReceipt(negotiatedOrder)
                  }}
                  className="w-full rounded-full bg-[#1F5C2E] px-3 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
                >
                  {confirmingOrderId === negotiatedOrder.id
                    ? "Confirmation…"
                    : "Confirmer la réception"}
                </button>
              )}
            </section>
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

  const activeOfferEntry = [...messages]
    .reverse()
    .map((message) => ({
      message,
      offer:
        message.message_type === "offer"
          ? parseOfferContent(message.content)
          : null,
    }))
    .find((entry) => entry.offer?.status === "pending")

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col lg:static lg:inset-auto lg:z-0 lg:h-full lg:min-h-[calc(100dvh-3.5rem)] lg:flex-1"
      style={{ backgroundColor: CHAT_AFRICA_BG.color }}
    >
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

        <button
          type="button"
          onClick={() => {
            setShowYelly(true)
            setYellyError("")
          }}
          className="p-2 rounded-full active:bg-white/20"
          aria-label="Conseil de négociation Yelly"
          title="Conseil de négociation Yelly"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void callOther("audio")}
          className="p-2.5 rounded-full active:bg-white/20"
          aria-label="Appel audio"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void callOther("video")}
          className="p-2.5 rounded-full active:bg-white/20"
          aria-label="Appel vidéo"
        >
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
                  {
                    key: "pin",
                    icon: Pin,
                    label: pinned ? "Désépingler" : "Épingler la conversation",
                  },
                  {
                    key: "mute",
                    icon: BellOff,
                    label: muted ? "Réactiver les notifs" : "Mettre en sourdine",
                  },
                  { key: "clear", icon: Trash2, label: "Effacer mes messages" },
                ].map((item) => (
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
        {loadedConversationId !== conversation.id ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-[#1F5C2E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[#667781]">Les messages ne sont pas disponibles.</p>
            <button
              type="button"
              onClick={() => {
                setLoadedConversationId(null)
                setReloadAttempt((attempt) => attempt + 1)
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1F5C2E] shadow-sm"
            >
              Réessayer
            </button>
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
                    <div
                      role="group"
                      tabIndex={0}
                      aria-label={`Message de ${own ? "vous" : otherName}`}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("button, a")) return
                        setSelectedMsg(selectedMsg === msg.id ? null : msg.id)
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault()
                          setSelectedMsg(selectedMsg === msg.id ? null : msg.id)
                        }
                      }}
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
                    </div>

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
        {peerTyping ? (
          <p className="px-4 pb-2 text-xs italic text-[#6B7280]">
            {other?.full_name?.split(" ")[0] || "L’autre"} écrit…
          </p>
        ) : null}
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
              <div key={i} className="w-[2px] bg-red-400/60 rounded-full shrink-0" style={{ height: `${3 + Math.sin((recordSec + i) * 0.5) * 10 + Math.sin(i * 1.7) * 2}px` }} />
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
                {
                  icon: ImageIcon,
                  color: "bg-violet-500",
                  label: "Galerie",
                  action: "gallery" as const,
                },
                {
                  icon: Camera,
                  color: "bg-pink-500",
                  label: "Caméra",
                  action: "camera" as const,
                },
                {
                  icon: FileText,
                  color: "bg-blue-500",
                  label: "Document",
                  action: "document" as const,
                },
                {
                  icon: HandCoins,
                  color: "bg-[#C27D10]",
                  label: "Négocier",
                  action: "offer" as const,
                },
                {
                  icon: MapPin,
                  color: "bg-green-500",
                  label: "Position",
                  action: "location" as const,
                },
              ].map((item) => (
                <button key={item.label} onClick={() => handleAttachmentAction(item.action)} className="flex flex-col items-center gap-2">
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

      {showYelly && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="yelly-negotiation-title"
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl safe-bottom sm:max-w-lg sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#1F5C2E]" />
                <h3 id="yelly-negotiation-title" className="text-lg font-semibold text-[#111]">
                  Yelly, aide à la négociation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowYelly(false)}
                className="rounded-full p-2 text-[#667781] active:bg-gray-100"
                aria-label="Fermer les conseils Yelly"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-[#667781]">
              Yelly reçoit ta question et, s&apos;il y en a une, les détails du produit et de l&apos;offre en cours. Elle ne reçoit pas l&apos;historique du chat.
            </p>
            {activeOfferEntry?.offer && (
              <div className="mb-3 rounded-xl bg-[#F3F7F2] px-3 py-2 text-sm text-[#1F5C2E]">
                {activeOfferEntry.offer.productName || "Offre en cours"} ·{" "}
                {formatOfferAmount(activeOfferEntry.offer.amount)} FCFA
              </div>
            )}
            <form onSubmit={askYelly} className="space-y-3">
              <textarea
                value={yellyQuestion}
                onChange={(event) => setYellyQuestion(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Comment répondre à cette offre ?"
                className="w-full resize-none rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
              />
              <button
                type="submit"
                disabled={yellyBusy || !yellyQuestion.trim()}
                className="h-11 w-full rounded-xl bg-[#1F5C2E] font-semibold text-white disabled:opacity-50"
              >
                {yellyBusy ? "Yelly réfléchit…" : "Demander un conseil"}
              </button>
            </form>
            {yellyError && <p role="alert" className="mt-3 text-sm text-red-600">{yellyError}</p>}
            {yellyReply && (
              <div className="mt-4 rounded-xl bg-[#F8F9F8] p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#111b21]">{yellyReply}</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewMessage(yellyReply)
                    setShowYelly(false)
                    inputRef.current?.focus()
                  }}
                  className="mt-3 text-sm font-semibold text-[#1F5C2E] hover:underline"
                >
                  Ajouter au brouillon
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* OFFRE DE PRIX — négociation commande */}
      {showOfferSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[108]" onClick={() => setShowOfferSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto bg-white rounded-t-3xl z-[109] p-5 pb-8 safe-bottom animate-slideUp">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-1">
              <HandCoins className="h-5 w-5 text-[#C27D10]" />
              <h3 className="text-lg font-semibold text-[#111]">
                {counterOfferId ? "Envoyer une contre-offre" : "Proposer un prix"}
              </h3>
            </div>
            <p className="text-sm text-[#667781] mb-4">
              {counterOfferId
                ? "Ajustez le prix et ajoutez vos conditions avant de répondre."
                : "Proposez un prix et précisez les conditions de votre offre."}
            </p>
            {offerProducts.length > 0 && (
              <>
                <label className="text-sm font-medium text-[#111] mb-1.5 block">
                  Produit
                </label>
                <select
                  value={offerProductId}
                  onChange={(e) => {
                    setOfferProductId(e.target.value)
                    const p = offerProducts.find((x) => x.id === e.target.value)
                    if (p) setOfferAmount(String(Math.round(p.price)))
                  }}
                  className="w-full h-11 rounded-xl border border-[#E5E7EB] px-3 text-sm mb-3 bg-white"
                >
                  {offerProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatOfferAmount(p.price)} FCFA{p.unit ? ` / ${p.unit}` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="text-sm font-medium text-[#111] mb-1.5 block">Prix unitaire proposé (FCFA)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="15000"
              className="w-full h-12 rounded-xl border border-[#E5E7EB] px-4 text-lg font-semibold tabular-nums mb-3 focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
            />
            <label className="text-sm font-medium text-[#111] mb-1.5 block">
              Quantité{offerProducts.find((product) => product.id === offerProductId)?.unit
                ? ` (${offerProducts.find((product) => product.id === offerProductId)?.unit})`
                : ""}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={offerQuantity}
              onChange={(e) => setOfferQuantity(e.target.value)}
              placeholder="1"
              className="w-full h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm tabular-nums mb-3 focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
            />
            {Number.parseInt(offerAmount, 10) > 0 && Number.parseInt(offerQuantity, 10) > 0 && (
              <p className="mb-3 text-right text-xs text-[#667781]">
                Total indicatif : {formatOfferAmount(
                  Number.parseInt(offerAmount, 10) * Number.parseInt(offerQuantity, 10),
                )} FCFA
              </p>
            )}
            <label className="text-sm font-medium text-[#111] mb-1.5 block">Message</label>
            <input
              type="text"
              value={offerNote}
              onChange={(e) => setOfferNote(e.target.value)}
              placeholder="2 sacs, livraison demain"
              className="w-full h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#1F5C2E]/30"
            />
            <button
              type="button"
              disabled={offerBusy}
              onClick={() => void sendPriceOffer()}
              className="w-full h-12 rounded-xl bg-[#1F5C2E] text-white font-semibold active:scale-[0.98] disabled:opacity-50"
            >
            {offerBusy ? "Envoi…" : counterOfferId ? "Envoyer la contre-offre" : "Envoyer l'offre"}
            </button>
          </div>
        </>
      )}

      {/* INPUT BAR — style WhatsApp : 1 seul micro (bouton vert à droite) */}
      {!isRecording && !audioPreview && (
        <div className="bg-[#f0f2f5] px-2 py-1.5 shrink-0 safe-bottom">
          <form onSubmit={handleSend} className="flex items-end gap-1.5">
            <div className="flex-1 flex items-center bg-white rounded-[25px] shadow-sm min-h-[48px] px-1.5">
              <button type="button" onClick={() => setShowEmojis(!showEmojis)}
                className={`p-2 shrink-0 ${showEmojis ? "text-[#1F5C2E]" : "text-[#54656f]"} active:text-[#1F5C2E]`} aria-label="Emojis">
                <Smile className="h-6 w-6" />
              </button>

              <input
                ref={inputRef}
                value={newMessage}
                onChange={e => {
                  setNewMessage(e.target.value)
                  signalTyping()
                }}
                placeholder="Message"
                className="flex-1 bg-transparent border-0 text-[15px] h-[48px] focus:outline-none placeholder:text-[#8696a0] px-1"
                enterKeyHint="send"
                autoComplete="off"
              />

              <button type="button" onClick={() => setShowAttach(true)}
                className="p-2 text-[#54656f] active:text-[#1F5C2E] shrink-0" aria-label="Joindre">
                <Paperclip className="h-6 w-6 -rotate-45" />
              </button>

              {!newMessage.trim() && (
                <button
                  type="button"
                  onClick={() => void openCameraCapture()}
                  disabled={cameraBusy}
                  className="p-2 text-[#54656f] active:text-[#1F5C2E] shrink-0 disabled:opacity-50"
                  aria-label="Caméra"
                >
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
              <button type="button" onClick={() => void toggleVoice()}
                className="w-[48px] h-[48px] rounded-full bg-[#1F5C2E] text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform shadow-sm"
                aria-label="Note vocale">
                <Mic className="h-5 w-5" />
              </button>
            )}
          </form>

          <input ref={camRef} type="file" className="hidden" accept="image/*" capture="environment"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f, "image"); e.target.value = "" }} />
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f, "file"); e.target.value = "" }} />
          <input ref={imgRef} type="file" className="hidden" accept="image/*,video/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f, "image"); e.target.value = "" }} />

          {showEmojis && (
            <div className="mt-1.5 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
              <div className="flex gap-1 overflow-x-auto border-b border-[#F3F4F6] px-2 py-1.5 scrollbar-none">
                {EMOJI_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setEmojiCat(cat.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      emojiCat === cat.id
                        ? "bg-[#E8F0E9] text-[#1F5C2E]"
                        : "text-[#667781] active:bg-gray-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="grid max-h-[220px] grid-cols-8 gap-0.5 overflow-y-auto p-2">
                {(EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis ?? []).map((emoji, idx) => (
                  <button
                    key={`${emoji}-${idx}`}
                    type="button"
                    onClick={() => {
                      setNewMessage((prev) => prev + emoji)
                      inputRef.current?.focus()
                    }}
                    className="rounded-lg p-1.5 text-[26px] leading-none transition-colors active:bg-gray-100 hover:bg-gray-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAMÉRA LIVE — getUserMedia (comme WhatsApp) */}
      {liveCameraOpen && (
        <div className="fixed inset-0 z-[130] bg-black flex flex-col">
          <div className="flex items-center justify-between px-3 py-3 safe-top text-white">
            <button
              type="button"
              onClick={stopLiveCamera}
              className="p-2 rounded-full active:bg-white/15"
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>
            <span className="text-sm font-medium">Photo</span>
            <span className="w-10" />
          </div>
          <div className="flex-1 relative min-h-0">
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="safe-bottom py-6 flex items-center justify-center gap-10 bg-black/80">
            <button
              type="button"
              onClick={fallbackNativeCameraInput}
              className="text-white text-xs opacity-80"
            >
              Autre
            </button>
            <button
              type="button"
              onClick={captureLivePhoto}
              className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Prendre la photo"
            >
              <span className="w-14 h-14 rounded-full bg-white" />
            </button>
            <span className="w-10" />
          </div>
        </div>
      )}
    </div>
  )
}
