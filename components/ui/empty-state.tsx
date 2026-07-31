import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#1F5C2E]/20 bg-[#FFF6E5]/40 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F5C2E]/10 text-[#1F5C2E]">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-base font-semibold text-[#1a1a1a]">{title}</p>
        {description ? (
          <p className="max-w-xs text-sm text-[#6B7280]">{description}</p>
        ) : null}
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-full bg-[#1F5C2E] px-5 py-2.5 text-sm font-semibold text-white active:scale-95"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionHref ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-full bg-[#1F5C2E] px-5 py-2.5 text-sm font-semibold text-white active:scale-95"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
