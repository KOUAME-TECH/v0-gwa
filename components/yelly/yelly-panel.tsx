"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { X, Send, LifeBuoy, Mic } from "lucide-react"
import { YELLY_NAME, YELLY_TAGLINE, yellySuggestionsForRole, yellyWelcomeForRole } from "@/lib/yelly/prompt"
import { WHATSAPP_LINK } from "@/lib/contact"
import { trackYelly } from "@/lib/yelly/analytics"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type ChatLine = { role: "user" | "assistant"; content: string }

function TypingDots() {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2"
      role="status"
      aria-live="polite"
      aria-label="Yelly écrit…"
    >
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" aria-hidden />
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" aria-hidden />
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" aria-hidden />
    </div>
  )
}

export function YellyPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const [userType, setUserType] = useState<string | null>(null)
  const [lines, setLines] = useState<ChatLine[]>([
    { role: "assistant", content: yellyWelcomeForRole(null) },
  ])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guestLeft, setGuestLeft] = useState<number | null>(null)
  const [yellyLeft, setYellyLeft] = useState<number | null>(null)
  const [yellyLimit, setYellyLimit] = useState<number | null>(null)
  const [escalating, setEscalating] = useState(false)
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const historyLoaded = useRef(false)
  const suggestions = yellySuggestionsForRole(userType)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== "Tab" || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener("keydown", onKey)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .maybeSingle()
        if (cancelled) return
        const ut = data?.user_type || null
        setUserType(ut)
        setLines((prev) => {
          if (prev.length === 1 && prev[0].role === "assistant") {
            return [{ role: "assistant", content: yellyWelcomeForRole(ut) }]
          }
          return prev
        })
      } catch {
        /* guest */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    inputRef.current?.focus()
  }, [open, lines, pending])

  // Mémoire session — recharge le dernier fil si connecté
  useEffect(() => {
    if (!open || historyLoaded.current) return
    historyLoaded.current = true
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/yelly/history")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.conversationId) setConversationId(data.conversationId)
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setLines([
            { role: "assistant", content: yellyWelcomeForRole(userType) },
            ...data.messages.map((m: { role: string; content: string }) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: String(m.content || ""),
            })),
          ] as ChatLine[])
        }
      } catch {
        /* anonyme / hors-ligne OK */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  function send(text: string) {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    setInput("")
    setLines((prev) => [...prev, { role: "user", content: message }])

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Réseau indisponible")
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hors ligne. Pour vendre : Publier. Pour acheter : Boutique (cache). WhatsApp +225 07 88 32 60 19.",
        },
      ])
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/yelly/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            page: pathname,
            conversationId,
            context: (() => {
              const m = pathname.match(/\/produit\/([0-9a-f-]{36})/i)
              return m ? { productId: m[1] } : undefined
            })(),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (typeof data.guestRemaining === "number") {
          setGuestLeft(data.guestRemaining)
        }
        if (typeof data.yellyRemaining === "number") {
          setYellyLeft(data.yellyRemaining)
        }
        if (typeof data.yellyLimit === "number") {
          setYellyLimit(data.yellyLimit)
        } else if (data.yellyLimit === null) {
          setYellyLimit(null)
        }
        if (!res.ok) {
          if (res.status === 401) {
            trackYelly("yelly_guest_limit")
            setError(data.error || "Limite invitée atteinte")
            setLines((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  data.reply ||
                  "Pour continuer avec moi, connecte-toi — ou écris-nous sur WhatsApp.",
              },
            ])
            return
          }
          if (data.code === "YELLY_DAILY_LIMIT") {
            setError(data.error || "Limite Yelly du jour")
            setYellyLeft(0)
            setLines((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  data.reply ||
                  "Tu as atteint ta limite Yelly du jour. Reviens demain, ou upgrade ton abo pour plus de questions.",
              },
            ])
            return
          }
          setError(data.error || "Erreur")
          setLines((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Je suis un peu saturée. Réessaie dans un instant, ou WhatsApp +225 07 88 32 60 19.",
            },
          ])
          return
        }
        if (data.conversationId) setConversationId(data.conversationId)
        const reply = String(data.reply || "")
        setLines((prev) => [...prev, { role: "assistant", content: reply }])
        if (data.resolved) trackYelly("yelly_resolved")
        // TTS optionnel (Yelly vocale) — discret, pas auto si utilisateur mute
        try {
          if (
            typeof window !== "undefined" &&
            window.speechSynthesis &&
            localStorage.getItem("yelly_tts") !== "0" &&
            reply
          ) {
            const u = new SpeechSynthesisUtterance(reply)
            u.lang = "fr-FR"
            u.rate = 0.95
            window.speechSynthesis.cancel()
            window.speechSynthesis.speak(u)
          }
        } catch {
          /* ignore */
        }
      } catch {
        setError("Réseau indisponible")
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Pas de réseau pour le moment. Réessaie dès que tu es reconnecté.",
          },
        ])
      }
    })
  }

  async function escalate() {
    if (escalating) return
    setEscalating(true)
    trackYelly("yelly_escalate")
    try {
      const summary = lines
        .slice(-6)
        .map((l) => `${l.role === "user" ? "Moi" : "Yelly"}: ${l.content}`)
        .join("\n")
        .slice(0, 3500)
      const res = await fetch("/api/yelly/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          page: pathname,
          conversationId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error ||
              "Impossible de créer le ticket. Utilise WhatsApp +225 07 88 32 60 19.",
          },
        ])
        return
      }
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.quietHours
              ? String(data.message || "Ticket noté — équipe dispo 8h–20h Abidjan.")
              : "C’est noté — un humain GWA va reprendre. Tu peux aussi WhatsApp pendant ce temps.",
        },
      ])
      trackYelly("yelly_resolved", { via: "escalate" })
    } finally {
      setEscalating(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end lg:items-end lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Yelly assistante GWA"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-label="Fermer Yelly"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 flex h-[min(78dvh,560px)] w-full flex-col overflow-hidden",
          "rounded-t-2xl lg:rounded-2xl lg:max-w-md",
          "border border-[#1F5C2E]/15 bg-[#F7F4EE] shadow-2xl",
          "animate-in slide-in-from-bottom-4 duration-300",
        )}
      >
        <header className="flex items-center gap-3 border-b border-[#1F5C2E]/10 bg-gradient-to-r from-[#1F5C2E] to-[#2d7a3e] px-4 py-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg font-semibold">
            Y
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight">{YELLY_NAME}</p>
            <p className="truncate text-xs text-white/80">{YELLY_TAGLINE}</p>
          </div>
          <a
            href={`${WHATSAPP_LINK}?text=${encodeURIComponent("Bonjour GWA, j’ai besoin d’aide (Yelly).")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/15"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.role}-${line.content.slice(0, 12)}`}
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                line.role === "user"
                  ? "ml-auto bg-[#1F5C2E] text-white"
                  : "mr-auto bg-white text-[#1a1a1a] shadow-sm ring-1 ring-black/5",
              )}
            >
              {line.content}
            </div>
          ))}
          {pending ? (
            <div className="mr-auto w-fit rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <TypingDots />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {!pending && lines.length < 4 ? (
          <div className="flex flex-wrap gap-2 border-t border-[#1F5C2E]/8 px-3 py-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-11 rounded-full border border-[#1F5C2E]/20 bg-white px-4 py-2.5 text-sm text-[#1F5C2E] transition hover:bg-[#1F5C2E]/5"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-[#1F5C2E]/8 px-3 py-2">
          <button
            type="button"
            onClick={() => void escalate()}
            disabled={escalating}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#1F5C2E]/20 bg-white px-3 py-2 text-xs font-medium text-[#1F5C2E] disabled:opacity-50"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            Passer à quelqu’un
          </button>
          {yellyLimit != null && yellyLeft != null ? (
            <span className="text-[11px] text-[#6B7280]">
              Yelly {yellyLeft}/{yellyLimit}
              {yellyLeft === 0 ? (
                <>
                  {" · "}
                  <Link href="/abonnement" className="font-medium text-[#1F5C2E] underline">
                    Upgrade
                  </Link>
                </>
              ) : null}
            </span>
          ) : null}
          {guestLeft != null && guestLeft <= 3 ? (
            <span className="text-[11px] text-[#6B7280]">
              {guestLeft > 0
                ? `${guestLeft} message${guestLeft > 1 ? "s" : ""} restant${guestLeft > 1 ? "s" : ""}`
                : "Connecte-toi pour continuer"}
            </span>
          ) : null}
          {guestLeft === 0 ? (
            <Link href="/auth/login" className="text-[11px] font-medium text-[#1F5C2E] underline">
              Connexion
            </Link>
          ) : null}
        </div>

        {error ? (
          <p className="px-3 pb-1 text-xs text-amber-800" role="status">
            {error}
          </p>
        ) : null}

        <form
          className="flex items-center gap-2 border-t border-[#1F5C2E]/10 bg-white/80 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <button
            type="button"
            onClick={() => {
              const SR =
                typeof window !== "undefined"
                  ? (window as unknown as {
                      SpeechRecognition?: new () => {
                        lang: string
                        onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
                        onerror: (() => void) | null
                        start: () => void
                      }
                      webkitSpeechRecognition?: new () => {
                        lang: string
                        onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
                        onerror: (() => void) | null
                        start: () => void
                      }
                    })
                  : null
              const Ctor = SR?.SpeechRecognition || SR?.webkitSpeechRecognition
              if (!Ctor) {
                setError("Dictée non supportée sur cet appareil")
                return
              }
              const rec = new Ctor()
              rec.lang = "fr-FR"
              rec.onresult = (e) => {
                const t = e.results?.[0]?.[0]?.transcript
                if (t) send(t)
              }
              rec.onerror = () => setError("Micro indisponible")
              rec.start()
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#1F5C2E]/20 text-[#1F5C2E]"
            aria-label="Parler à Yelly"
            disabled={pending}
          >
            <Mic className="h-4 w-4" />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={800}
            placeholder="Dis-moi ce dont tu as besoin…"
            aria-label="Message pour Yelly"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-[#1F5C2E]/15 bg-[#F7F4EE] px-4 py-2.5 text-base outline-none ring-[#1F5C2E]/30 focus:ring-2"
            disabled={pending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1F5C2E] text-white disabled:opacity-40"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
