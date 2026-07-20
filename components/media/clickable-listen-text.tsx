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

export type ListenPlaybackProps = {
  text?: string | null
  audioUrl?: string | null
  fallbackLabel?: string
  lang?: string
}

function useListenPlayback({
  text,
  audioUrl,
  fallbackLabel = "Message vocal",
  lang = "fr-FR",
}: ListenPlaybackProps) {
  const mode = resolveListenMode(text, audioUrl)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const speechText = text?.trim() || fallbackLabel
  const canListen = mode !== "none" && !!speechText

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

  const toggleListen = useCallback(async () => {
    if (!canListen) return

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
      const utter = new SpeechSynthesisUtterance(speechText)
      utter.lang = lang
      utter.rate = 0.95
      utter.onend = () => setPlaying(false)
      utter.onerror = () => setPlaying(false)
      setPlaying(true)
      window.speechSynthesis.speak(utter)
    }
  }, [audioUrl, canListen, lang, mode, playing, speechText, stopAll])

  useEffect(() => () => stopAll(), [stopAll])

  return { mode, playing, canListen, toggleListen, speechText }
}

type MicIconProps = {
  mode: ListenMode
  playing: boolean
  size: "xs" | "sm"
}

function MicIcon({ mode, playing, size }: MicIconProps) {
  const icon = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"
  if (playing) return <Square className={cn(icon, "fill-current")} />
  if (mode === "audio") return <Mic className={icon} />
  return <Volume2 className={icon} />
}

export type ListenMicButtonProps = ListenPlaybackProps & {
  className?: string
  size?: "xs" | "sm"
}

/** Micro minimaliste — icône seule. */
export function ListenMicButton({
  text,
  audioUrl,
  fallbackLabel,
  lang,
  className,
  size = "sm",
}: ListenMicButtonProps) {
  const { mode, playing, canListen, toggleListen } = useListenPlayback({
    text,
    audioUrl,
    fallbackLabel,
    lang,
  })

  if (!canListen) return null

  const dim = size === "xs" ? "h-6 w-6" : "h-7 w-7"

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleListen()
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90",
        dim,
        playing
          ? "bg-[#C27D10]/15 text-[#C27D10] ring-1 ring-[#C27D10]/30"
          : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/14",
        className,
      )}
      aria-label={playing ? "Arrêter" : mode === "audio" ? "Écouter la note vocale" : "Écouter le texte"}
    >
      <MicIcon mode={mode} playing={playing} size={size} />
    </button>
  )
}

export type ClickableListenTextProps = ListenPlaybackProps & {
  className?: string
  showText?: boolean
  textClassName?: string
}

/** Texte + micro inline discret. */
export function ClickableListenText({
  text,
  audioUrl,
  fallbackLabel = "Message vocal — appuyez pour écouter",
  className,
  lang = "fr-FR",
  showText = true,
  textClassName,
}: ClickableListenTextProps) {
  const { mode, playing, canListen, toggleListen, speechText } = useListenPlayback({
    text,
    audioUrl,
    fallbackLabel,
    lang,
  })

  if (!speechText) return null

  if (!canListen) {
    return (
      <span className={cn("text-[15px] leading-relaxed text-[#374151]", className, textClassName)}>
        {speechText}
      </span>
    )
  }

  if (!showText) {
    return (
      <ListenMicButton
        text={text}
        audioUrl={audioUrl}
        fallbackLabel={fallbackLabel}
        lang={lang}
        className={className}
      />
    )
  }

  const display = mode === "audio" && !text?.trim() ? fallbackLabel : speechText

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[15px] leading-relaxed",
        playing ? "text-[#1F5C2E]" : "text-[#374151]",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleListen}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 transition-all active:scale-90",
          playing
            ? "bg-[#C27D10]/15 text-[#C27D10]"
            : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/14",
        )}
        aria-label={playing ? "Arrêter" : "Écouter"}
      >
        <MicIcon mode={mode} playing={playing} size="sm" />
      </button>
      <span
        role="button"
        tabIndex={0}
        onClick={toggleListen}
        onKeyDown={(e) => e.key === "Enter" && toggleListen()}
        className={cn("flex-1 min-w-0 cursor-pointer", textClassName)}
      >
        {display}
      </span>
    </p>
  )
}

export { resolveListenMode }
