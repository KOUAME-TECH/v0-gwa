import { cn } from "@/lib/utils"

type GwaMarkProps = {
  size?: number
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
  href?: string
}

/**
 * Marque Harmattan — G blanc sur vert #1F5C2E + feuille or #C27D10 (icon.svg / icon-192).
 */
export function GwaMark({
  size = 36,
  className,
  showWordmark = false,
  wordmarkClassName,
}: GwaMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src="/icon.svg"
        alt="GWA"
        width={size}
        height={size}
        className="rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/15 object-cover shrink-0"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight text-[color:var(--gwa-primary,#1F5C2E)] dark:text-[#A8D5B5]",
            wordmarkClassName,
          )}
        >
          GWA
        </span>
      )}
    </span>
  )
}
