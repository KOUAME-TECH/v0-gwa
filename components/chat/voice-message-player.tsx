"use client"

/**
 * Lecteur vocal style WhatsApp — play/pause, waveform progress, vitesse, seek.
 * Pas d’autoplay. Contrôles ≥44px + ARIA.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export const VOICE_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const
export type VoicePlaybackSpeed = (typeof VOICE_PLAYBACK_SPEEDS)[number]

const BAR_COUNT = 28

function syntheticBars(seed: string, count = BAR_COUNT): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin((h % 97) * 0.17 + i * 0.55) * 0.5 + 0.5
    return Math.round(4 + n * 14)
  })
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00"
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

export type VoiceMessagePlayerProps = {
  src: string | null | undefined
  durationLabel?: string
  transcript?: string | null
  messageId?: string
  className?: string
}

export function VoiceMessagePlayer({
  src,
  durationLabel,
  transcript,
  messageId = "voice",
  className,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentSec, setCurrentSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [speed, setSpeed] = useState<VoicePlaybackSpeed>(1)
  const bars = syntheticBars(messageId)
  const labelId = useId()

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute("src")
      a.load()
    }
    audioRef.current = null
    setPlaying(false)
    setProgress(0)
    setCurrentSec(0)
  }, [])

  useEffect(() => () => stopAudio(), [stopAudio])

  useEffect(() => {
    const a = audioRef.current
    if (a) a.playbackRate = speed
  }, [speed])

  function ensureAudio(): HTMLAudioElement | null {
    if (!src) return null
    if (audioRef.current) return audioRef.current
    const a = new Audio(src)
    a.preload = "metadata"
    a.playbackRate = speed
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) setDurationSec(a.duration)
    }
    a.ontimeupdate = () => {
      const d = a.duration || durationSec || 1
      setCurrentSec(a.currentTime)
      setProgress(Math.min(1, a.currentTime / d))
    }
    a.onended = () => {
      setPlaying(false)
      setProgress(0)
      setCurrentSec(0)
      a.currentTime = 0
    }
    a.onerror = () => {
      setPlaying(false)
    }
    audioRef.current = a
    return a
  }

  async function togglePlay() {
    if (!src) return
    const a = ensureAudio()
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
      return
    }
    try {
      a.playbackRate = speed
      await a.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  function seekToRatio(ratio: number) {
    const a = ensureAudio()
    if (!a) return
    const d = a.duration || durationSec
    if (!Number.isFinite(d) || d <= 0) return
    const next = Math.max(0, Math.min(1, ratio)) * d
    a.currentTime = next
    setCurrentSec(next)
    setProgress(next / d)
  }

  function onWavePointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    seekToRatio((e.clientX - rect.left) / rect.width)
  }

  function cycleSpeed() {
    const idx = VOICE_PLAYBACK_SPEEDS.indexOf(speed)
    const next = VOICE_PLAYBACK_SPEEDS[(idx + 1) % VOICE_PLAYBACK_SPEEDS.length]
    setSpeed(next)
  }

  const clock =
    playing || currentSec > 0
      ? formatClock(currentSec)
      : durationLabel || formatClock(durationSec)

  return (
    <div className={cn("space-y-1.5 min-w-[200px]", className)}>
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            void togglePlay()
          }}
          disabled={!src}
          className="w-11 h-11 min-h-[44px] min-w-[44px] bg-[#1F5C2E] rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C27D10] active:scale-95"
          aria-label={
            playing
              ? transcript
                ? `Pause du message vocal. Transcription : ${transcript}`
                : "Mettre en pause le message vocal"
              : transcript
                ? `Écouter le message vocal. Transcription : ${transcript}`
                : "Écouter le message vocal"
          }
          aria-pressed={playing}
          aria-describedby={transcript ? labelId : undefined}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current" aria-hidden>
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current" aria-hidden>
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        <div
          role="slider"
          tabIndex={src ? 0 : -1}
          aria-label="Position dans le message vocal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={`${Math.round(progress * 100)} pour cent`}
          className="flex-1 flex items-center gap-[2px] min-h-[44px] cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F5C2E] px-0.5"
          onPointerDown={(e) => {
            e.stopPropagation()
            onWavePointer(e)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault()
              seekToRatio(progress + 0.05)
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              seekToRatio(progress - 0.05)
            } else if (e.key === "Home") {
              e.preventDefault()
              seekToRatio(0)
            } else if (e.key === "End") {
              e.preventDefault()
              seekToRatio(1)
            }
          }}
        >
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress
            return (
              <div
                key={i}
                className={cn(
                  "w-[3px] rounded-full shrink-0 transition-colors",
                  filled ? "bg-[#1F5C2E]" : "bg-[#1F5C2E]/35",
                )}
                style={{ height: `${h}px` }}
                aria-hidden
              />
            )
          })}
        </div>

        <span className="text-[11px] opacity-70 shrink-0 tabular-nums w-9 text-right">
          {clock}
        </span>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            cycleSpeed()
          }}
          className="min-h-[44px] min-w-[44px] px-1 rounded-full text-[11px] font-semibold text-[#1F5C2E] tabular-nums active:bg-[#1F5C2E]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F5C2E]"
          aria-label={`Vitesse de lecture ${speed} fois. Changer la vitesse.`}
        >
          {speed}×
        </button>
      </div>

      {transcript ? (
        <p
          id={labelId}
          className="text-[12px] leading-snug text-[#54656f] px-1 whitespace-pre-wrap break-words"
        >
          {transcript}
        </p>
      ) : null}
    </div>
  )
}
