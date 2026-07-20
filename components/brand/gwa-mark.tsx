import { cn } from "@/lib/utils"

type GwaMarkProps = {
  size?: number
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
  href?: string
}

/**
 * Marque Harmattan visible in-app (pas seulement dans le manifeste PWA).
 */
export function GwaMark({
  size = 36,
  className,
  showWordmark = false,
  wordmarkClassName,
}: GwaMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt="GWA"
        width={size}
        height={size}
        className="rounded-lg shadow-sm ring-1 ring-black/5 object-cover shrink-0"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span className={cn("font-bold tracking-tight text-[#1F5C2E]", wordmarkClassName)}>
          GWA
        </span>
      )}
    </span>
  )
}
