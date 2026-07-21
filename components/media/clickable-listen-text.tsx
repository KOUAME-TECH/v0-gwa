"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { VoiceMessageChip } from "@/components/media/voice-message-chip"
import { AudioLangBadge } from "@/components/media/audio-lang-badge"
import { AUDIO_LABELS } from "@/lib/accessibility/audio-labels"
import { buildCognitiveSummary } from "@/lib/accessibility/cognitive-summary"
import { resolveUtterLang } from "@/lib/media/audio-langs"
import { recordListenActivity } from "@/hooks/use-listen-ritual"
import { useAutoListenOnView } from "@/hooks/use-contextual-listen"

type ListenMode = "audio" | "tts" | "none"

export function resolveListenMode(
  text?: string | null,
  audioUrl?: string | null,
  fallbackLabel?: string | null,
): ListenMode {
  if (audioUrl) return "audio"
  if ((text && text.trim()) || (fallbackLabel && fallbackLabel.trim())) return "tts"
  return "none"
}

export type ListenPlaybackProps = {
  text?: string | null
  audioUrl?: string | null
  fallbackLabel?: string
  lang?: string
  audioLang?: string | null
}

function useListenPlayback({
  text,
  audioUrl,
  fallbackLabel,
  lang,
  audioLang,
}: ListenPlaybackProps) {
  const utterLang = lang ?? resolveUtterLang(audioLang)
  const mode = resolveListenMode(text, audioUrl, fallbackLabel)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const speechText = text?.trim() || fallbackLabel?.trim() || ""
  const canListen = mode !== "none" && (mode === "audio" ? !!audioUrl : !!speechText)

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
        audioRef.current.onerror = () => {
          // Fichier audio KO → bascule TTS si texte dispo
          setPlaying(false)
          if (speechText && typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel()
            const utter = new SpeechSynthesisUtterance(speechText)
            utter.lang = utterLang
            utter.rate = 0.95
            utter.onend = () => setPlaying(false)
            utter.onerror = () => setPlaying(false)
            setPlaying(true)
            window.speechSynthesis.speak(utter)
          }
        }
      } else {
        audioRef.current.src = audioUrl
      }
      setPlaying(true)
      recordListenActivity()
      try {
        await audioRef.current.play()
      } catch {
        // Autoplay / lecture bloquée → TTS
        if (speechText && typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const utter = new SpeechSynthesisUtterance(speechText)
          utter.lang = utterLang
          utter.rate = 0.95
          utter.onend = () => setPlaying(false)
          utter.onerror = () => setPlaying(false)
          window.speechSynthesis.speak(utter)
        } else {
          setPlaying(false)
        }
      }
      return
    }

    if (mode === "tts" && typeof window !== "undefined" && window.speechSynthesis && speechText) {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(speechText)
      utter.lang = utterLang
      utter.rate = 0.95
      utter.onend = () => setPlaying(false)
      utter.onerror = () => setPlaying(false)
      setPlaying(true)
      recordListenActivity()
      window.speechSynthesis.speak(utter)
    }
  }, [audioUrl, canListen, utterLang, mode, playing, speechText, stopAll])

  useEffect(() => () => stopAll(), [stopAll])

  return { mode, playing, canListen, toggleListen, speechText }
}

type ListenControlProps = {
  mode: ListenMode
  playing: boolean
  size: "xs" | "sm"
  onClick: () => void
  highlight?: boolean
  className?: string
}

function ListenControl({ mode, playing, size, onClick, highlight, className }: ListenControlProps) {
  const dim = size === "xs" ? "h-6 w-6" : "h-7 w-7"
  const aria =
    playing
      ? AUDIO_LABELS.stop
      : mode === "audio"
        ? AUDIO_LABELS.playVoice
        : AUDIO_LABELS.playText

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
        dim,
        playing
          ? "bg-[#C27D10]/15 text-[#C27D10] ring-1 ring-[#C27D10]/30"
          : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/14",
        highlight && !playing && "ring-2 ring-[#1F5C2E]/25 animate-pulse-soft",
        className,
      )}
      aria-label={aria}
      aria-pressed={playing}
    >
      {playing ? (
        <Square className={cn(size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5", "fill-current")} />
      ) : (
        <AudioWaveIcon
          playing={false}
          size={size === "xs" ? "xs" : "sm"}
          variant={mode === "tts" ? "synth" : "recorded"}
        />
      )}
    </button>
  )
}

export type ListenMicButtonProps = ListenPlaybackProps & {
  className?: string
  size?: "xs" | "sm"
  highlight?: boolean
}

/** Contrôle écoute minimaliste — symbole onde. */
export function ListenMicButton({
  text,
  audioUrl,
  fallbackLabel,
  lang,
  audioLang,
  className,
  size = "sm",
  highlight,
}: ListenMicButtonProps) {
  const { mode, playing, canListen, toggleListen } = useListenPlayback({
    text,
    audioUrl,
    fallbackLabel,
    lang,
    audioLang,
  })

  if (!canListen) return null

  return (
    <ListenControl
      mode={mode}
      playing={playing}
      size={size}
      onClick={toggleListen}
      highlight={highlight}
      className={className}
    />
  )
}

export type ClickableListenTextProps = ListenPlaybackProps & {
  className?: string
  showText?: boolean
  textClassName?: string
  highlight?: boolean
  /** Résumé cognitif 1 phrase (contraste cognitif) */
  showSummary?: boolean
  /** Écoute auto au scroll (mode écoute feed) */
  autoListen?: boolean
}

/** Texte + onde, ou puce vocale sans « appuyez pour… ». */
export function ClickableListenText({
  text,
  audioUrl,
  fallbackLabel,
  className,
  lang,
  audioLang,
  showText = true,
  textClassName,
  highlight,
  showSummary,
  autoListen,
}: ClickableListenTextProps) {
  const { mode, playing, canListen, toggleListen, speechText } = useListenPlayback({
    text,
    audioUrl,
    fallbackLabel,
    lang,
    audioLang,
  })

  const autoRef = useAutoListenOnView(!!autoListen, canListen, toggleListen, playing)
  const summary = showSummary ? buildCognitiveSummary(speechText) : null

  if (!canListen && !speechText) return null

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
        highlight={highlight}
      />
    )
  }

  // Note vocale seule → puce ondes (pas de texte « appuyez pour… »)
  if (mode === "audio" && !text?.trim()) {
    return (
      <VoiceMessageChip
        playing={playing}
        onClick={toggleListen}
        size="sm"
        className={className}
      />
    )
  }

  return (
    <div ref={autoRef} className={cn("space-y-1", className)}>
      <p
        className={cn(
          "flex items-start gap-1.5 text-[15px] leading-relaxed",
          playing ? "text-[#1F5C2E]" : "text-[#374151]",
        )}
      >
        <ListenControl
          mode={mode}
          playing={playing}
          size="sm"
          onClick={toggleListen}
          highlight={highlight}
        />
        <span
          role="button"
          tabIndex={0}
          onClick={toggleListen}
          onKeyDown={(e) => e.key === "Enter" && toggleListen()}
          className={cn("flex-1 min-w-0 cursor-pointer", textClassName)}
        >
          {speechText}
        </span>
        <AudioLangBadge lang={audioLang} />
      </p>
      {summary && (
        <p className="pl-8 text-xs text-[#6B7280] leading-snug" aria-hidden>
          {summary}
        </p>
      )}
    </div>
  )
}

export { useListenPlayback }
