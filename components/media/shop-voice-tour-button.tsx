"use client"

import React from "react"
import { Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { AUDIO_LABELS } from "@/lib/accessibility/audio-labels"

export type ShopVoiceTourButtonProps = {
  active: boolean
  index: number
  total: number
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  className?: string
  /** Décoratif dans un parent déjà cliquable (évite nested interactive). */
  decorative?: boolean
}

/** Lance le parcours vocal marketplace — lit les produits un par un. */
export function ShopVoiceTourButton({
  active,
  index,
  total,
  onClick,
  disabled,
  className,
  decorative,
}: ShopVoiceTourButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || decorative}
      tabIndex={decorative ? -1 : undefined}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full transition-all active:scale-95 disabled:opacity-40",
        "h-9 px-3",
        active
          ? "bg-[#C27D10]/15 text-[#C27D10] ring-1 ring-[#C27D10]/30"
          : "bg-[#1F5C2E]/8 text-[#1F5C2E] hover:bg-[#1F5C2E]/14",
        total === 0 && !disabled && "opacity-60",
        decorative && "pointer-events-none",
        className,
      )}
      aria-label={decorative ? undefined : active ? AUDIO_LABELS.shopTourStop : AUDIO_LABELS.shopTour}
      aria-pressed={decorative ? undefined : active}
      aria-disabled={total === 0}
    >
      {active ? (
        <Square className="h-3.5 w-3.5 fill-current shrink-0" />
      ) : (
        <AudioWaveIcon playing={false} size="sm" variant="synth" />
      )}
      <span className="text-xs font-medium whitespace-nowrap">
        {active && total > 0 ? `${index + 1}/${total}` : "Parcours"}
      </span>
      {active && <AudioWaveIcon playing size="xs" variant="recorded" className="opacity-90" />}
    </button>
  )
}
