"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { ShopVoiceTourButton } from "@/components/media/shop-voice-tour-button"

export type DigestBannerProps = {
  count: number
  city?: string | null
  /** Sous-titre libre (ex. "sélection de la semaine près de Abidjan") */
  subtitle?: string | null
  tourActive: boolean
  tourIndex: number
  tourTotal: number
  onStartTour: () => void
  className?: string
}

/** Bannière nouveautés audio — clic = écoute immédiate (pas de button imbriqué). */
export function DigestBanner({
  count,
  city,
  subtitle,
  tourActive,
  tourIndex,
  tourTotal,
  onStartTour,
  className,
}: DigestBannerProps) {
  if (count === 0) return null

  const place = city?.trim() || "votre région"
  const idleLine =
    subtitle?.trim() ||
    `${count} nouveau${count > 1 ? "x" : ""} près de ${place}. Écouter`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onStartTour}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onStartTour()
        }
      }}
      className={cn(
        "mb-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#1F5C2E]/15 bg-gradient-to-r from-[#1F5C2E]/8 to-[#FFF6E5] px-3 py-2.5 text-left active:scale-[0.99] transition-transform",
        className,
      )}
      aria-label={tourActive ? "Arrêter les nouveautés audio" : "Écouter les nouveautés"}
    >
      <AudioWaveIcon playing={tourActive} size="md" variant="recorded" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1F5C2E]">Nouveautés près de toi</p>
        <p className="text-xs text-[#4B5563] truncate">
          {tourActive
            ? `${tourIndex + 1}/${tourTotal} · ${place}`
            : idleLine}
        </p>
      </div>
      <ShopVoiceTourButton
        active={tourActive}
        index={tourIndex}
        total={tourTotal}
        onClick={onStartTour}
        decorative
        idleLabel="Écouter"
        ariaLabelStart="Écouter les nouveautés"
        ariaLabelStop="Arrêter les nouveautés"
        className="shrink-0"
      />
    </div>
  )
}
