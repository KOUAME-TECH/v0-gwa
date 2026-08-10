"use client"

import { useCallback, useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  formatLikesBadge,
  likeButtonLabel,
  nextLikesCount,
  normalizeLikesCount,
} from "@/lib/products/likes"

type Props = {
  productId: string
  initialLiked?: boolean
  initialCount?: number
  /** compact = icon only (marketplace overlay) */
  variant?: "feed" | "compact" | "detail"
  className?: string
  disabled?: boolean
  onAuthRequired?: () => void
  onChange?: (liked: boolean, count: number) => void
}

export function ProductLikeButton({
  productId,
  initialLiked = false,
  initialCount = 0,
  variant = "feed",
  className,
  disabled,
  onAuthRequired,
  onChange,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(normalizeLikesCount(initialCount))
  const [pending, startTransition] = useTransition()

  const toggle = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      if (disabled || pending) return

      const prevLiked = liked
      const prevCount = count
      const willLike = !liked

      setLiked(willLike)
      setCount(nextLikesCount(count, willLike))

      startTransition(async () => {
        try {
          const res = await fetch(`/api/products/${productId}/like`, {
            method: "POST",
          })
          const data = await res.json().catch(() => ({}))
          if (res.status === 401) {
            setLiked(prevLiked)
            setCount(prevCount)
            if (onAuthRequired) onAuthRequired()
            else toast.error("Connecte-toi pour aimer ce produit")
            return
          }
          if (!res.ok) {
            setLiked(prevLiked)
            setCount(prevCount)
            toast.error(data.error || "Impossible d'enregistrer le j'aime")
            return
          }
          const nextLiked = !!data.liked
          const nextCount = normalizeLikesCount(data.likes_count)
          setLiked(nextLiked)
          setCount(nextCount)
          onChange?.(nextLiked, nextCount)
        } catch {
          setLiked(prevLiked)
          setCount(prevCount)
          toast.error("Réseau indisponible")
        }
      })
    },
    [
      count,
      disabled,
      liked,
      onAuthRequired,
      onChange,
      pending,
      productId,
    ],
  )

  const badge = formatLikesBadge(count)
  const label = likeButtonLabel(liked, count)

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-label={label}
        aria-pressed={liked}
        className={cn(
          "absolute top-2 right-2 min-h-11 min-w-11 flex items-center justify-center",
          className,
        )}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              liked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]",
            )}
          />
          {badge ? (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-1 text-[9px] font-semibold tabular-nums text-[#4B5563] shadow-sm">
              {badge}
            </span>
          ) : null}
        </span>
      </button>
    )
  }

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-label={label}
        aria-pressed={liked}
        className={cn(
          "min-h-11 min-w-11 rounded-full bg-white shadow-sm flex flex-col items-center justify-center gap-0.5 px-2 active:scale-95 transition-transform",
          className,
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5",
            liked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]",
          )}
        />
        {badge ? (
          <span className="text-[10px] font-semibold tabular-nums text-[#4B5563]">
            {badge}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      aria-label={label}
      aria-pressed={liked}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-2 min-h-11 rounded-full active:bg-[#FFF6E5] transition-colors",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-6 w-6 transition-colors",
          liked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]",
        )}
      />
      {count > 0 && (
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            liked ? "text-[#F39A1F]" : "text-[#4B5563]",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
