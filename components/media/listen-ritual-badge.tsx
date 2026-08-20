"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { LISTEN_RITUAL_GOAL } from "@/hooks/use-listen-ritual"

export type ListenRitualBadgeProps = {
  streak: number
  className?: string
}

/** Badge streak Harmattan — discret, sans gamification agressive. */
export function ListenRitualBadge({ streak, className }: ListenRitualBadgeProps) {
  if (streak < 1) return null

  const done = streak >= LISTEN_RITUAL_GOAL

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        done
          ? "bg-[#1F5C2E]/12 text-[#1F5C2E] ring-1 ring-[#1F5C2E]/20"
          : "bg-[#C27D10]/10 text-[#C27D10]",
        className,
      )}
      title={done ? "Écoute du jour accomplie" : `${streak}/${LISTEN_RITUAL_GOAL} jours d’écoute`}
    >
      <AudioWaveIcon playing={done} size="xs" variant={done ? "recorded" : "synth"} />
      {done ? "Écoute OK" : `${streak}j d’écoute`}
    </span>
  )
}
