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
  /** soft = carte arrondie moderne ; compact = micro plus petit dans le feed */
  variant?: "soft" | "compact"
}

/**
 * Texte + micro — tap pour écouter (TTS ou fichier audio).
 * Style doux, lisible pour ceux qui préfèrent lire.
 */
export function ClickableListenText({
  text,
  audioUrl,
  fallbackLabel = "Message vocal — appuyez pour écouter",
  className,
  lang = "fr-FR",
  variant = "soft",
}: ClickableListenTextProps) {
  const mode = resolveListenMode(text, audioUrl)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const displayText = text?.trim() || (mode !== "none" ? fallbackLabel : "")
  const listenLabel =
    mode === "audio" ? "Écouter la note vocale" : mode === "tts" ? "Écouter" : ""

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
      utter.rate = 0.95
      utter.onend = () => setPlaying(false)
      utter.onerror = () => setPlaying(false)
      setPlaying(true)
      window.speechSynthesis.speak(utter)
    }
  }, [audioUrl, displayText, lang, mode, playing, stopAll, text])

  useEffect(() => () => stopAll(), [stopAll])

  if (!displayText) return null

  if (mode === "none") {
    return <span className={cn("text-[15px] leading-relaxed text-[#374151]", className)}>{displayText}</span>
  }

  const isCompact = variant === "compact"
  const btnSize = isCompact ? "w-11 h-11" : "w-12 h-12"
  const iconSize = isCompact ? "h-5 w-5" : "h-6 w-6"

  return (
    <div
      className={cn(
        "flex gap-2.5 items-stretch",
        variant === "soft" && "rounded-2xl bg-gradient-to-br from-[#FFF9F0] to-[#F0F7F1] p-2.5 shadow-sm border border-[#1F5C2E]/8",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleListen}
        className={cn(
          "shrink-0 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 self-start",
          btnSize,
          playing
            ? "bg-[#C27D10] shadow-md ring-2 ring-[#C27D10]/25"
            : "bg-[#1F5C2E] hover:bg-[#174A24] shadow-sm",
        )}
        aria-label={playing ? "Arrêter la lecture" : listenLabel}
      >
        {playing ? (
          <Square className={cn(iconSize, "text-white fill-white")} />
        ) : mode === "audio" ? (
          <Mic className={cn(iconSize, "text-white")} />
        ) : (
          <Volume2 className={cn(iconSize, "text-white")} />
        )}
      </button>

      <button
        type="button"
        onClick={handleListen}
        className={cn(
          "flex-1 text-left min-w-0 rounded-xl px-3 py-2 transition-colors duration-200",
          playing ? "bg-white/80" : "hover:bg-white/50 active:bg-white/70",
        )}
        aria-label={listenLabel}
      >
        <p className="text-[11px] font-medium text-[#1F5C2E]/80 mb-0.5 tracking-wide">
          {playing ? "Lecture…" : listenLabel}
        </p>
        <p
          className={cn(
            "leading-relaxed whitespace-pre-wrap text-[#1F2937]",
            isCompact ? "text-sm" : "text-[15px]",
            playing && "text-[#1F5C2E]",
          )}
        >
          {displayText}
        </p>
      </button>
    </div>
  )
}

export { resolveListenMode }
