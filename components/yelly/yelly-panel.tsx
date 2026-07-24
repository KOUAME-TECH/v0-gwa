"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname } from "next/navigation"
import { X, Send, MessageCircle } from "lucide-react"
import { YELLY_NAME, YELLY_SUGGESTIONS, YELLY_TAGLINE } from "@/lib/yelly/prompt"
import { WHATSAPP_LINK } from "@/lib/contact"
import { cn } from "@/lib/utils"

type ChatLine = { role: "user" | "assistant"; content: string }

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2" aria-label="Yelly écrit…">
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" />
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" />
      <span className="gwa-dot inline-block h-1.5 w-1.5 rounded-full bg-[#1F5C2E]" />
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
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "assistant",
      content:
        "Salut, je suis Yelly — l'assistante GWA. Boutique, Digest, commandes, vérification… dis-moi ce dont tu as besoin.",
    },
  ])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      inputRef.current?.focus()
    }
  }, [open, lines, pending])

  function send(text: string) {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    setInput("")
    setLines((prev) => [...prev, { role: "user", content: message }])

    startTransition(async () => {
      try {
        const res = await fetch("/api/yelly/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            page: pathname,
            conversationId,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            setError("Connecte-toi pour parler à Yelly.")
            setLines((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "Connecte-toi pour continuer avec moi. Tu peux aussi m'écrire sur WhatsApp en attendant.",
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
        setLines((prev) => [
          ...prev,
          { role: "assistant", content: String(data.reply || "") },
        ])
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end sm:items-end sm:p-4"
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
        className={cn(
          "relative z-10 flex h-[min(78dvh,560px)] w-full flex-col overflow-hidden",
          "rounded-t-2xl sm:rounded-2xl sm:max-w-md",
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

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.role}`}
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
            {YELLY_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-[#1F5C2E]/20 bg-white px-3 py-1 text-xs text-[#1F5C2E] transition hover:bg-[#1F5C2E]/5"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

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
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={800}
            placeholder="Écris à Yelly…"
            className="min-w-0 flex-1 rounded-full border border-[#1F5C2E]/15 bg-[#F7F4EE] px-4 py-2.5 text-sm outline-none ring-[#1F5C2E]/30 focus:ring-2"
            disabled={pending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1F5C2E] text-white disabled:opacity-40"
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

export function YellyFab() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Masquer sur auth / admin (éviter bruit UX)
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dev")
  ) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full",
          "bg-[#C45C26] px-4 py-2.5 text-sm font-medium text-white shadow-lg",
          "transition hover:scale-[1.02] active:scale-95",
          "lg:bottom-6",
          open && "pointer-events-none opacity-0",
        )}
        aria-label="Ouvrir Yelly, assistante GWA"
      >
        <MessageCircle className="h-4 w-4" />
        Yelly
      </button>
      <YellyPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
