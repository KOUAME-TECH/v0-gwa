"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { useListenMode } from "@/hooks/use-listen-mode"

export type ListenModeToggleProps = {
  className?: string
  compact?: boolean
}

/** Toggle « Mode écoute » — met en avant les ondes partout (WCAG, rétention). */
export function ListenModeToggle({ className, compact }: ListenModeToggleProps) {
  const { enabled, toggle, hydrated } = useListenMode()

  if (!hydrated) return null

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full transition-all active:scale-95",
        compact ? "h-8 px-2" : "h-9 px-3",
        enabled
          ? "bg-[#1F5C2E] text-white shadow-sm"
          : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/14",
        className,
      )}
      aria-pressed={enabled}
      aria-label={enabled ? "Désactiver le mode écoute" : "Activer le mode écoute"}
    >
      <AudioWaveIcon
        playing={enabled}
        size="xs"
        variant={enabled ? "recorded" : "synth"}
        className={enabled ? "[&_span]:bg-white" : undefined}
      />
      {!compact && (
        <span className="text-xs font-medium">{enabled ? "Mode écoute" : "Écouter"}</span>
      )}
    </button>
  )
}
