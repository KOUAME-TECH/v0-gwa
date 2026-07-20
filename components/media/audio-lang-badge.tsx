"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { audioLangLabel } from "@/lib/media/audio-langs"

export type AudioLangBadgeProps = {
  lang?: string | null
  className?: string
}

/** Badge langue voix communautaire (Wolof, Bambara…). */
export function AudioLangBadge({ lang, className }: AudioLangBadgeProps) {
  const label = audioLangLabel(lang)
  if (!label) return null

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full bg-[#1F5C2E]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1F5C2E]",
        className,
      )}
      aria-label={`Langue : ${label}`}
    >
      {label}
    </span>
  )
}
