"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageCircle, User, Plus, Bell, Search, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"
import { isSellerRole } from "@/lib/dashboard/routing"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"
import { useNavBadges } from "@/hooks/use-nav-badges"

interface NavItem {
  href: string
  icon: typeof Home
  label: string
  world: "social" | "commerce" | "messaging" | "profile"
  isCenter?: boolean
  badge?: number
}

export function BottomNav() {
  const pathname = usePathname()
  const visible = shouldShowBottomNav(pathname)
  const scrollHidden = useHideOnScroll(visible)
  const {
    userId,
    userType,
    unreadMessages,
    unreadNotifs,
    cartCount,
    activeOrders,
  } = useNavBadges({ enabled: visible })

  if (!visible) return null

  const user = userId ? { id: userId } : null
  const unreadNotifications = unreadNotifs
  const ordersCount = activeOrders

  const isSeller = isSellerRole(userType)

  const getActiveWorld = (): "social" | "commerce" | "messaging" | "profile" | null => {
    if (pathname === "/" || pathname?.startsWith("/recherche") || pathname === "/publier")
      return "social"
    if (
      pathname?.startsWith("/marketplace") ||
      pathname?.startsWith("/produit") ||
      pathname?.startsWith("/panier") ||
      pathname?.startsWith("/agriculture") ||
      pathname?.startsWith("/dashboard/products") ||
      pathname?.startsWith("/dashboard/commandes") ||
      pathname?.startsWith("/dashboard/farmer") ||
      pathname?.startsWith("/wallet") ||
      pathname?.startsWith("/scg") ||
      pathname?.startsWith("/affacturage")
    )
      return "commerce"
    if (pathname?.startsWith("/messages")) return "messaging"
    if (
      pathname?.startsWith("/profil") ||
      pathname?.startsWith("/notifications") ||
      pathname?.startsWith("/favoris") ||
      pathname?.startsWith("/dashboard") ||
      pathname?.startsWith("/abonnement")
    )
      return "profile"
    return null
  }

  const activeWorld = getActiveWorld()

  const worldColors = {
    social: { bg: "bg-[#F39A1F]", text: "text-[#F39A1F]" },
    commerce: { bg: "bg-[#2F7D32]", text: "text-[#2F7D32]" },
    messaging: { bg: "bg-[#1DA1F2]", text: "text-[#1DA1F2]" },
    profile: { bg: "bg-[#6B7280]", text: "text-[#6B7280]" },
  }

  const navItems: NavItem[] = [
    { href: "/", icon: Home, label: "Accueil", world: "social" },
    {
      href: "/marketplace",
      icon: Store,
      label: "Marché",
      world: "commerce",
      badge: ordersCount > 0 ? ordersCount : undefined,
    },
    {
      href: isSeller ? "/publier" : "/recherche",
      icon: isSeller ? Plus : Search,
      label: isSeller ? "Publier" : "Chercher",
      world: "social",
      isCenter: true,
    },
    {
      href: "/messages",
      icon: MessageCircle,
      label: "Messages",
      world: "messaging",
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      href: user ? "/profil" : "/auth/login",
      icon: User,
      label: user ? "Moi" : "Connexion",
      world: "profile",
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
  ]

  return (
    <>
      {user && (
        <div
          className={cn(
            "pointer-events-none fixed bottom-[76px] right-3 z-40 flex flex-col items-end gap-2 animate-fadeIn transition-transform duration-300 ease-out lg:hidden",
            scrollHidden && "translate-y-[120%] pointer-events-none opacity-0",
          )}
        >
          {(pathname?.startsWith("/produit/") ||
            pathname?.startsWith("/marketplace/product/")) &&
            cartCount > 0 && (
              <Link
                href="/panier"
                className="pointer-events-auto flex min-h-11 items-center gap-2 bg-[#2F7D32] text-white rounded-full pl-3 pr-4 py-2.5 shadow-lg shadow-[#2F7D32]/25 active:scale-95 transition-transform"
                aria-label={`Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="text-sm font-semibold">{cartCount}</span>
              </Link>
            )}
          {unreadNotifications > 0 && pathname !== "/notifications" && (
            <Link
              href="/notifications"
              className="pointer-events-auto flex min-h-11 items-center gap-2 bg-white border border-[#E5E7EB] rounded-full pl-3 pr-4 py-2.5 shadow-md active:scale-95 transition-transform"
              aria-label={`${unreadNotifications} notification${unreadNotifications > 1 ? "s" : ""}`}
            >
              <Bell className="h-4 w-4 text-[#F39A1F]" />
              <span className="text-xs font-semibold text-[#111827]">{unreadNotifications}</span>
            </Link>
          )}
        </div>
      )}

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out lg:hidden",
          scrollHidden && "translate-y-full",
        )}
        role="navigation"
        aria-label="Navigation principale"
        aria-hidden={scrollHidden}
      >
        <div className="h-[2px] bg-[#E5E7EB] relative">
          {activeWorld && (
            <div
              className={cn(
                "absolute top-0 h-full transition-all duration-300 ease-out rounded-full",
                worldColors[activeWorld].bg,
              )}
              style={{
                width: "20%",
                left:
                  activeWorld === "social"
                    ? "0%"
                    : activeWorld === "commerce"
                      ? "20%"
                      : activeWorld === "messaging"
                        ? "60%"
                        : "80%",
              }}
            />
          )}
        </div>

        <div className="bg-white/95 backdrop-blur-lg border-t border-white/50 pb-safe">
          <div className="flex items-center justify-around max-w-lg mx-auto h-[60px] px-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)
              const Icon = item.icon
              const itemColor = isActive ? worldColors[item.world] : null

              if (item.isCenter) {
                return (
                  <Link
                    key={item.label}
                    href={
                      !isSeller
                        ? item.href
                        : user
                          ? item.href
                          : "/auth/login?redirect=/publier"
                    }
                    className="relative -mt-4"
                    aria-label={item.label}
                    tabIndex={scrollHidden ? -1 : undefined}
                  >
                    <div
                      className={cn(
                        "w-[52px] h-[52px] rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all duration-200",
                        isSeller
                          ? "bg-gradient-to-br from-[#2F7D32] to-[#1B5E20] shadow-[#2F7D32]/30"
                          : "bg-gradient-to-br from-[#F39A1F] to-[#E88A0C] shadow-[#F39A1F]/30",
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-semibold mt-0.5 block text-center",
                        isSeller ? "text-[#2F7D32]" : "text-[#F39A1F]",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-1.5 px-2 active:scale-90 transition-all duration-200 min-w-[56px] rounded-xl",
                    isActive && "bg-black/[0.03]",
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  tabIndex={scrollHidden ? -1 : undefined}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px] transition-all duration-200",
                        isActive && itemColor ? itemColor.text : "text-[#6B7280]",
                      )}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      fill={isActive ? "currentColor" : "none"}
                    />
                    {item.badge && item.badge > 0 && (
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-2 min-w-[16px] h-[16px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1",
                          item.world === "messaging"
                            ? "bg-[#1DA1F2]"
                            : item.world === "commerce"
                              ? "bg-[#2F7D32]"
                              : "bg-[#F39A1F]",
                        )}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-all duration-200 leading-tight",
                        isActive && itemColor
                        ? cn(itemColor.text, "font-semibold")
                        : "text-[#6B7280]",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
