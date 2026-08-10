"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, ShoppingBag, Wallet, LayoutDashboard, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"

const LINKS = [
  { href: "/dashboard/farmer", label: "Mon espace", icon: LayoutDashboard, match: (p: string) => p === "/dashboard/farmer" },
  {
    href: "/dashboard/commandes?tab=ventes",
    label: "Mes ventes",
    icon: ShoppingBag,
    match: (p: string) => p.startsWith("/dashboard/commandes"),
  },
  {
    href: "/dashboard/products",
    label: "Mes produits",
    icon: Package,
    match: (p: string) => p.startsWith("/dashboard/products"),
  },
  {
    href: "/wallet",
    label: "Mon argent",
    icon: Wallet,
    match: (p: string) => p.startsWith("/wallet") || p.startsWith("/affacturage"),
  },
  {
    href: "/scg",
    label: "Mon score",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/scg"),
  },
] as const

/**
 * Sous-nav producteur — une seule IA pour ventes / produits / argent / score.
 * À placer sous le header des pages vendeur.
 */
export function ProducerSubnav({ className }: { className?: string }) {
  const pathname = usePathname() || ""

  return (
    <nav
      aria-label="Espace producteur"
      className={cn(
        "sticky top-0 z-20 -mx-1 mb-4 flex items-center gap-1 overflow-x-auto bg-[#FFF6E5]/95 px-1 py-2 backdrop-blur-sm",
        className,
      )}
    >
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "bg-[#1F5C2E] text-white"
                : "bg-white text-[#1F5C2E] ring-1 ring-[#1F5C2E]/15 hover:bg-[#E8F5E9]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        )
      })}
      <div className="ml-auto shrink-0 pl-2">
        <YellyAideButton source="producer_subnav" className="text-[#1F5C2E]" />
      </div>
    </nav>
  )
}
