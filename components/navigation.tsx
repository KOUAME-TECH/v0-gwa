"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Store, MessageCircle, User, Search, Plus } from "lucide-react"
import { GwaMark } from "@/components/brand/gwa-mark"
import { shouldShowDesktopNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Feed", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/marketplace",
    label: "Boutique",
    icon: Store,
    match: (p: string) => p.startsWith("/marketplace") || p.startsWith("/produit"),
  },
  {
    href: "/recherche",
    label: "Explorer",
    icon: Search,
    match: (p: string) => p.startsWith("/recherche"),
  },
  {
    href: "/messages",
    label: "Chat",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/messages"),
  },
  {
    href: "/profil",
    label: "Moi",
    icon: User,
    match: (p: string) =>
      p.startsWith("/profil") || p.startsWith("/notifications") || p.startsWith("/favoris"),
  },
] as const

/**
 * Navigation desktop / tablette large — barre haute.
 * Mobile reste sur BottomNav.
 */
export function Navigation() {
  const pathname = usePathname() || "/"
  if (!shouldShowDesktopNav(pathname)) return null

  return (
    <header
      className="sticky top-0 z-50 hidden border-b border-[#E5E7EB]/80 bg-white/90 backdrop-blur-lg lg:block"
      role="navigation"
      aria-label="Navigation bureau"
    >
      <div className="gwa-shell-wide flex h-14 items-center gap-6 px-4 xl:px-6">
        <Link href="/" className="shrink-0" aria-label="GWA accueil">
          <GwaMark size={32} showWordmark wordmarkClassName="text-xl" />
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-1">
          {LINKS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#1F5C2E]/10 text-[#1F5C2E]"
                    : "text-[#4B5563] hover:bg-black/[0.04] hover:text-[#111827]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/marketplace?digest=1"
            className="rounded-full bg-[#1F5C2E]/10 px-3 py-1.5 text-xs font-semibold text-[#1F5C2E] transition hover:bg-[#1F5C2E]/15"
          >
            Digest
          </Link>
          <Link
            href="/publier"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1F5C2E] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#184a25]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Publier
          </Link>
        </div>
      </div>
    </header>
  )
}
