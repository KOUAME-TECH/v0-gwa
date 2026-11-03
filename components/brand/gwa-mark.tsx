import { cn } from "@/lib/utils"

type GwaMarkProps = {
  size?: number
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
  href?: string
}

/**
 * Marque Harmattan — source brand `public/icon-master.png` (alias `/master.png`).
 * G blanc sur vert #1F5C2E + feuille or #C27D10.
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
        src="/icon-master.png"
        alt="GWA"
        width={size}
        height={size}
        className="rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/15 object-cover shrink-0"
        style={{ width: size, height: size }}
        decoding="async"
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
