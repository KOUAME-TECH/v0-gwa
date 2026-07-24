"use client"

import { useYellyOptional } from "@/components/yelly/yelly-provider"
import { cn } from "@/lib/utils"

/** Lien texte Aide — jamais un FAB flottant (évite de surcharger l’écran). */
export function YellyAideButton({
  source = "header",
  className,
  compact,
}: {
  source?: string
  className?: string
  compact?: boolean
}) {
  const yelly = useYellyOptional()
  if (!yelly) return null
  return (
    <button
      type="button"
      onClick={() => yelly.openYelly(source)}
      className={cn(
        "text-sm font-medium text-[#4B5563] transition hover:text-[#1F5C2E] active:opacity-80",
        compact && "h-8 px-2 text-xs rounded-xl",
        className,
      )}
      aria-label="Ouvrir l'aide Yelly"
    >
      Aide
    </button>
  )
}
