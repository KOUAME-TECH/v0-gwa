"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Square, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ListenMode = "audio" | "tts" | "none"

function resolveListenMode(text?: string | null, audioUrl?: string | null): ListenMode {
  if (audioUrl) return "audio"
  if (text && text.trim()) return "tts"
  return "none"
}

export type ClickableListenTextProps = {
  text?: string | null
  audioUrl?: string | null
  fallbackLabel?: string
  className?: string
  lang?: string
}

/**
 * Texte + micro vert visible (48px) — tap micro ou texte pour écouter.
 */
export function ClickableListenText({
  text,
  audioUrl,
  fallbackLabel = "Message vocal — appuyez pour écouter",
  className,
  lang = "fr-FR",
}: ClickableListenTextProps) {
  const mode = resolveListenMode(text, audioUrl)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const displayText = text?.trim() || (mode !== "none" ? fallbackLabel : "")
  const listenLabel =
    mode === "audio" ? "Écouter la note vocale" : mode === "tts" ? "Écouter le texte" : ""

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setPlaying(false)
  }, [])

  const handleListen = useCallback(async () => {
    if (mode === "none" || !displayText) return

    if (playing) {
      stopAll()
      return
    }

    if (mode === "audio" && audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl)
        audioRef.current.onended = () => setPlaying(false)
        audioRef.current.onerror = () => setPlaying(false)
      } else {
        audioRef.current.src = audioUrl
      }
      setPlaying(true)
      try {
        await audioRef.current.play()
      } catch {
        setPlaying(false)
      }
      return
    }

    if (mode === "tts" && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text!.trim())
      utter.lang = lang
      utter.onend = () => setPlaying(false)
      utter.onerror = () => setPlaying(false)
      setPlaying(true)
      window.speechSynthesis.speak(utter)
    }
  }, [audioUrl, displayText, lang, mode, playing, stopAll, text])

  useEffect(() => () => stopAll(), [stopAll])

  if (!displayText) return null

  if (mode === "none") {
    return <span className={className}>{displayText}</span>
  }

  return (
    <div className={cn("flex gap-3 items-start", className)}>
      <button
        type="button"
        onClick={handleListen}
        className={cn(
          "shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95",
          playing ? "bg-[#C27D10] ring-2 ring-[#C27D10]/40" : "bg-[#1F5C2E] hover:bg-[#174A24]",
        )}
        aria-label={playing ? "Arrêter" : listenLabel}
      >
        {playing ? (
          <Square className="h-5 w-5 text-white fill-white" />
        ) : mode === "audio" ? (
          <Mic className="h-6 w-6 text-white" />
        ) : (
          <Volume2 className="h-6 w-6 text-white" />
        )}
      </button>

      <button
        type="button"
        onClick={handleListen}
        className={cn(
          "flex-1 text-left rounded-xl px-3 py-2.5 min-w-0 transition-colors",
          "border border-[#1F5C2E]/15",
          playing
            ? "bg-[#1F5C2E]/10 ring-1 ring-[#1F5C2E]/25"
            : "bg-[#1F5C2E]/5 hover:bg-[#1F5C2E]/10 active:bg-[#1F5C2E]/15",
        )}
        aria-label={listenLabel}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1F5C2E] mb-1">
          {playing ? "Lecture en cours…" : listenLabel}
        </p>
        <p
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap text-[#111827]",
            playing && "text-[#1F5C2E] font-medium",
          )}
        >
          {displayText}
        </p>
      </button>
    </div>
  )
}

export { resolveListenMode }
