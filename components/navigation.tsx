"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { GwaMark } from "@/components/brand/gwa-mark"
import { useYellyOptional } from "@/components/yelly/yelly-provider"
import { shouldShowDesktopNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Accueil", match: (p: string) => p === "/" },
  {
    href: "/marketplace",
    label: "Boutique",
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
 * Barre desktop Harmattan — texte + marque, sans pastilles style mobile.
 * Yelly s'ouvre via « Aide » (pas de FAB flottant sur ordi/tablette).
 */
export function Navigation() {
  const pathname = usePathname() || "/"
  const yelly = useYellyOptional()
  if (!shouldShowDesktopNav(pathname)) return null

  return (
    <header
      className="sticky top-0 z-50 hidden border-b border-[#1F5C2E]/10 bg-[#FFF6E5]/92 backdrop-blur-md lg:block"
      role="navigation"
      aria-label="Navigation bureau"
    >
      <div className="gwa-shell-wide flex h-16 items-center gap-8 px-6 xl:px-8">
        <Link href="/" className="shrink-0" aria-label="GWA accueil">
          <GwaMark size={36} showWordmark wordmarkClassName="font-display text-[1.35rem] tracking-tight" />
        </Link>

        <nav className="flex flex-1 items-stretch justify-center gap-1">
          {LINKS.map(({ href, label, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
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
          <button
            type="button"
            onClick={() => yelly?.openYelly("desktop_nav")}
            className="text-sm font-medium text-[#4B5563] transition hover:text-[#1F5C2E]"
          >
            Aide
          </button>
          <Link
            href="/marketplace?digest=1"
            className="text-sm font-semibold text-[#1F5C2E] underline-offset-4 hover:underline"
          >
            Digest
          </Link>
          <Link
            href="/publier"
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
