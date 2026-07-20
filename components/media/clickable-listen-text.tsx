"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Volume2, Square } from "lucide-react"
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
  /** Texte affiché si pas de texte (ex. placeholder vocal) */
  fallbackLabel?: string
  className?: string
  lang?: string
}

/**
 * WhatsApp+ agri : tap sur le texte pour écouter.
 * - audio_url → lecture du fichier
 * - sinon texte → synthèse vocale (fr-FR) pour illettrés / terrain
 */
export function ClickableListenText({
  text,
  audioUrl,
  fallbackLabel = "Appuyez pour écouter",
  className,
  lang = "fr-FR",
}: ClickableListenTextProps) {
  const mode = resolveListenMode(text, audioUrl)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const displayText = text?.trim() || (mode !== "none" ? fallbackLabel : "")

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

  const handleClick = useCallback(async () => {
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
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group text-left w-full rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5C2E]/40",
        playing
          ? "bg-[#1F5C2E]/10 ring-1 ring-[#1F5C2E]/25"
          : "hover:bg-[#1F5C2E]/5 active:bg-[#1F5C2E]/10",
        className,
      )}
      aria-label={playing ? "Arrêter la lecture" : "Écouter le texte"}
    >
      <span className="inline-flex items-start gap-1.5">
        {playing ? (
          <Square className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#1F5C2E]" aria-hidden />
        ) : (
          <Volume2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#1F5C2E]/70 group-hover:text-[#1F5C2E]" aria-hidden />
        )}
        <span
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            playing && "text-[#1F5C2E] font-medium",
          )}
        >
          {displayText}
        </span>
      </span>
    </button>
  )
}

export { resolveListenMode }
