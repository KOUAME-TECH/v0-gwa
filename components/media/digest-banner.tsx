"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { AudioWaveIcon } from "@/components/media/audio-wave-icon"
import { ShopVoiceTourButton } from "@/components/media/shop-voice-tour-button"

export type DigestBannerProps = {
  count: number
  city?: string | null
  tourActive: boolean
  tourIndex: number
  tourTotal: number
  onStartTour: () => void
  className?: string
}

/** Bannière Harmattan Digest — lance le parcours vocal des nouveaux produits. */
export function DigestBanner({
  count,
  city,
  tourActive,
  tourIndex,
  tourTotal,
  onStartTour,
  className,
}: DigestBannerProps) {
  if (count === 0) return null

  const place = city?.trim() || "votre région"

  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-3 rounded-2xl border border-[#1F5C2E]/15 bg-gradient-to-r from-[#1F5C2E]/8 to-[#FFF6E5] px-3 py-2.5",
        className,
      )}
    >
      <AudioWaveIcon playing={tourActive} size="md" variant="recorded" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1F5C2E]">Harmattan Digest</p>
        <p className="text-xs text-[#4B5563] truncate">
          {count} nouveau{count > 1 ? "x" : ""} produit{count > 1 ? "s" : ""} — {place}
        </p>
      </div>
      <ShopVoiceTourButton
        active={tourActive}
        index={tourIndex}
        total={tourTotal}
        onClick={onStartTour}
        className="shrink-0"
      />
    </div>
  )
}
