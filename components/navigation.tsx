"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { GwaMark } from "@/components/brand/gwa-mark"
import { YellyAideButton } from "@/components/yelly/yelly-aide-button"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
import { shouldShowDesktopNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Accueil", match: (p: string) => p === "/" },
  {
    href: "/marketplace",
    label: "Marché",
    match: (p: string) => p.startsWith("/marketplace") || p.startsWith("/produit"),
  },
  {
    href: "/recherche",
    label: "Explorer",
    match: (p: string) => p.startsWith("/recherche"),
  },
  {
    href: "/messages",
    label: "Messages",
    match: (p: string) => p.startsWith("/messages"),
  },
  {
    href: "/profil",
    label: "Profil",
    match: (p: string) =>
      p.startsWith("/profil") || p.startsWith("/notifications") || p.startsWith("/favoris"),
  },
] as const

/**
 * Barre desktop Harmattan — disparaît au scroll bas (comme bottom nav).
 */
export function Navigation() {
  const pathname = usePathname() || "/"
  const visible = shouldShowDesktopNav(pathname)
  const scrollHidden = useHideOnScroll(visible)

  if (!visible) return null

  return (
    <header
      className={cn(
        "sticky top-0 z-50 hidden border-b border-[#1F5C2E]/10 bg-[#FFF6E5]/92 backdrop-blur-md lg:block",
        "transition-transform duration-300 ease-out will-change-transform",
        scrollHidden && "-translate-y-full",
      )}
      role="navigation"
      aria-label="Navigation bureau"
      aria-hidden={scrollHidden}
    >
      <div className="gwa-shell-wide flex h-16 items-center gap-8 px-6 xl:px-8">
        <Link href="/" className="shrink-0" aria-label="GWA accueil" tabIndex={scrollHidden ? -1 : undefined}>
          <GwaMark size={36} showWordmark wordmarkClassName="font-display text-[1.35rem] tracking-tight" />
        </Link>

        <nav className="flex flex-1 items-stretch justify-center gap-1">
          {LINKS.map(({ href, label, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                tabIndex={scrollHidden ? -1 : undefined}
                className={cn(
                  "relative flex items-center px-3 text-[0.95rem] transition-colors",
                  active
                    ? "font-semibold text-[#1F5C2E]"
                    : "font-medium text-[#4B5563] hover:text-[#111827]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#1F5C2E]"
                  />
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <YellyAideButton source="desktop_nav" />
          <Link
            href="/marketplace?digest=1"
            tabIndex={scrollHidden ? -1 : undefined}
            className="text-sm font-semibold text-[#1F5C2E] underline-offset-4 hover:underline"
          >
            Nouveautés
          </Link>
          <Link
            href="/publier"
            tabIndex={scrollHidden ? -1 : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5C2E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#184a25]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Publier
          </Link>
        </div>
      </div>
    </header>
  )
}
