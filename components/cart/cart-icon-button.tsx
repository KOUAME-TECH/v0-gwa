"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCartCount } from "@/hooks/use-cart-count"
import { cn } from "@/lib/utils"

export function CartIconButton({
  className,
  iconClassName,
}: {
  className?: string
  iconClassName?: string
}) {
  const { count } = useCartCount()

  return (
    <Link
      href="/panier"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#4B5563] active:opacity-70",
        className,
      )}
      aria-label={count > 0 ? `Panier, ${count} articles` : "Panier"}
    >
      <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C27D10] px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}
