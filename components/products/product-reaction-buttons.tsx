"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Heart, ThumbsDown } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  dislikeButtonLabel,
  formatCountBadge,
  likeButtonLabel,
  nextReactionState,
  normalizeCount,
  type ProductReaction,
} from "@/lib/products/likes"

type Props = {
  productId: string
  initialReaction?: ProductReaction
  initialLiked?: boolean
  initialDisliked?: boolean
  initialLikesCount?: number
  initialDislikesCount?: number
  /** compact = overlay marché ; detail = fiche ; feed = barre actions */
  variant?: "feed" | "compact" | "detail"
  className?: string
  disabled?: boolean
  onAuthRequired?: () => void
  onChange?: (state: {
    reaction: ProductReaction
    likes_count: number
    dislikes_count: number
  }) => void
}

export function ProductReactionButtons({
  productId,
  initialReaction = null,
  initialLiked = false,
  initialDisliked = false,
  initialLikesCount = 0,
  initialDislikesCount = 0,
  variant = "feed",
  className,
  disabled,
  onAuthRequired,
  onChange,
}: Props) {
  const seedReaction: ProductReaction =
    initialReaction ?? (initialLiked ? "like" : initialDisliked ? "dislike" : null)
  const [reaction, setReaction] = useState<ProductReaction>(seedReaction)
  const [likesCount, setLikesCount] = useState(normalizeCount(initialLikesCount))
  const [dislikesCount, setDislikesCount] = useState(
    normalizeCount(initialDislikesCount),
  )
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setReaction(
      initialReaction ?? (initialLiked ? "like" : initialDisliked ? "dislike" : null),
    )
    setLikesCount(normalizeCount(initialLikesCount))
    setDislikesCount(normalizeCount(initialDislikesCount))
  }, [
    initialDisliked,
    initialDislikesCount,
    initialLiked,
    initialLikesCount,
    initialReaction,
    productId,
  ])

  const run = useCallback(
    (action: "like" | "dislike", e?: React.MouseEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      if (disabled || pending) return

      const prev = {
        reaction,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      }
      const next = nextReactionState(reaction, action, likesCount, dislikesCount)
      setReaction(next.reaction)
      setLikesCount(next.likes_count)
      setDislikesCount(next.dislikes_count)

      startTransition(async () => {
        try {
          const res = await fetch(`/api/products/${productId}/${action}`, {
            method: "POST",
          })
          const data = await res.json().catch(() => ({}))
          if (res.status === 401) {
            setReaction(prev.reaction)
            setLikesCount(prev.likes_count)
            setDislikesCount(prev.dislikes_count)
            if (onAuthRequired) onAuthRequired()
            else toast.error("Connecte-toi pour réagir")
            return
          }
          if (!res.ok) {
            setReaction(prev.reaction)
            setLikesCount(prev.likes_count)
            setDislikesCount(prev.dislikes_count)
            toast.error(data.error || "Impossible d'enregistrer")
            return
          }
          const synced = {
            reaction: (data.reaction as ProductReaction) ?? null,
            likes_count: normalizeCount(data.likes_count),
            dislikes_count: normalizeCount(data.dislikes_count),
          }
          setReaction(synced.reaction)
          setLikesCount(synced.likes_count)
          setDislikesCount(synced.dislikes_count)
          onChange?.(synced)
        } catch {
          setReaction(prev.reaction)
          setLikesCount(prev.likes_count)
          setDislikesCount(prev.dislikes_count)
          toast.error("Réseau indisponible")
        }
      })
    },
    [
      disabled,
      dislikesCount,
      likesCount,
      onAuthRequired,
      onChange,
      pending,
      productId,
      reaction,
    ],
  )

  const liked = reaction === "like"
  const disliked = reaction === "dislike"
  const likeBadge = formatCountBadge(likesCount)
  const dislikeBadge = formatCountBadge(dislikesCount)

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "absolute top-2 left-2 flex flex-col gap-1",
          className,
        )}
      >
        <button
          type="button"
          onClick={(e) => run("like", e)}
          disabled={disabled || pending}
          aria-label={likeButtonLabel(liked, likesCount)}
          aria-pressed={liked}
          className="min-h-11 min-w-11 flex items-center justify-center"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                liked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]",
              )}
            />
            {likeBadge ? (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-1 text-[9px] font-semibold tabular-nums text-[#4B5563] shadow-sm">
                {likeBadge}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => run("dislike", e)}
          disabled={disabled || pending}
          aria-label={dislikeButtonLabel(disliked, dislikesCount)}
          aria-pressed={disliked}
          className="min-h-11 min-w-11 flex items-center justify-center"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
            <ThumbsDown
              className={cn(
                "h-4 w-4 transition-colors",
                disliked ? "fill-[#9CA3AF] text-[#374151]" : "text-[#4B5563]",
              )}
            />
            {dislikeBadge ? (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-1 text-[9px] font-semibold tabular-nums text-[#4B5563] shadow-sm">
                {dislikeBadge}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={(e) => run("like", e)}
        disabled={disabled || pending}
        aria-label={likeButtonLabel(liked, likesCount)}
        aria-pressed={liked}
        className={cn(
          "flex min-h-11 items-center gap-1.5 px-2.5 py-2 rounded-full active:bg-[#FFF6E5] transition-colors",
          variant === "detail" && "rounded-xl bg-white shadow-sm ring-1 ring-[#E5E7EB]",
        )}
      >
        <Heart
          className={cn(
            variant === "detail" ? "h-5 w-5" : "h-6 w-6",
            "transition-colors",
            liked ? "fill-[#F39A1F] text-[#F39A1F]" : "text-[#4B5563]",
          )}
        />
        {likesCount > 0 ? (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              liked ? "text-[#F39A1F]" : "text-[#4B5563]",
            )}
          >
            {likeBadge || likesCount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={(e) => run("dislike", e)}
        disabled={disabled || pending}
        aria-label={dislikeButtonLabel(disliked, dislikesCount)}
        aria-pressed={disliked}
        className={cn(
          "flex min-h-11 items-center gap-1.5 px-2.5 py-2 rounded-full active:bg-[#FFF6E5] transition-colors",
          variant === "detail" && "rounded-xl bg-white shadow-sm ring-1 ring-[#E5E7EB]",
        )}
      >
        <ThumbsDown
          className={cn(
            variant === "detail" ? "h-5 w-5" : "h-6 w-6",
            "transition-colors",
            disliked ? "fill-[#9CA3AF] text-[#374151]" : "text-[#4B5563]",
          )}
        />
        {dislikesCount > 0 ? (
          <span className="text-sm font-medium tabular-nums text-[#4B5563]">
            {dislikeBadge || dislikesCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}
