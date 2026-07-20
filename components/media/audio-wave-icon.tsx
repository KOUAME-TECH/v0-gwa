"use client"

import React from "react"
import { cn } from "@/lib/utils"

export type AudioWaveIconProps = {
  playing?: boolean
  /** xs = badge · sm = inline · md = message chip */
  size?: "xs" | "sm" | "md"
  /** recorded = vert · synth = ambre (TTS) */
  variant?: "recorded" | "synth"
  className?: string
}

const heights = {
  xs: ["h-1.5", "h-2.5", "h-1.5"],
  sm: ["h-2", "h-3.5", "h-2"],
  md: ["h-2.5", "h-5", "h-2.5"],
}

const widths = { xs: "w-0.5", sm: "w-0.5", md: "w-1" }

/**
 * Symbole onde GWA — remplace le texte « appuyez pour écouter ».
 * 3 barres = contenu audio (WCAG: décoratif si aria-hidden sur parent bouton).
 */
export function AudioWaveIcon({
  playing = false,
  size = "sm",
  variant = "recorded",
  className,
}: AudioWaveIconProps) {
  const barHeights = heights[size]
  const barWidth = widths[size]
  const color = variant === "synth" ? "bg-[#C27D10]" : "bg-[#1F5C2E]"

  return (
    <span
      className={cn("inline-flex items-end justify-center gap-0.5", className)}
      aria-hidden
    >
      {barHeights.map((h, i) => (
        <span
          key={i}
          className={cn(
            barWidth,
            "rounded-full transition-colors",
            playing ? color : cn(color, "opacity-80"),
            playing ? "animate-gwa-wave" : h,
            !playing && h,
          )}
          style={
            playing
              ? { animationDelay: `${i * 0.12}s`, height: undefined }
              : undefined
          }
        />
      ))}
    </span>
  )
}
