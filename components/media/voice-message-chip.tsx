"use client"

import React from "react"
import { Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { AUDIO_LABELS, VOICE_VISIBLE_LABEL } from "@/lib/accessibility/audio-labels"

export type VoiceMessageChipProps = {
  playing?: boolean
  onClick?: () => void
  size?: "sm" | "md"
  className?: string
  /** Afficher le libellé court à côté des ondes */
  showLabel?: boolean
}

/** Puce message vocal — ondes uniquement, style WhatsApp épuré. */
export function VoiceMessageChip({
  playing = false,
  onClick,
  size = "sm",
  className,
  showLabel = true,
}: VoiceMessageChipProps) {
  const dim = size === "md" ? "h-9 px-3" : "h-7 px-2"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full transition-all active:scale-95",
        dim,
        playing
          ? "bg-[#C27D10]/12 text-[#C27D10] ring-1 ring-[#C27D10]/25"
          : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/12",
        className,
      )}
      aria-label={playing ? AUDIO_LABELS.stop : AUDIO_LABELS.playVoice}
      aria-pressed={playing}
    >
      {playing ? (
        <Square className={cn(size === "md" ? "h-3.5 w-3.5" : "h-3 w-3", "fill-current shrink-0")} />
      ) : (
        <AudioWaveIcon playing={false} size={size === "md" ? "md" : "sm"} variant="recorded" />
      )}
      {playing ? (
        <AudioWaveIcon playing size={size === "md" ? "md" : "sm"} variant="recorded" className="opacity-90" />
      ) : showLabel ? (
        <span className={cn("font-medium", size === "md" ? "text-sm" : "text-xs")}>
          {VOICE_VISIBLE_LABEL}
        </span>
      ) : null}
    </button>
  )
}
