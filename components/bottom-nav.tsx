"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingBag, MessageCircle, User, Plus, Bell, Search, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll"

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
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    // Économie ressources : pas de polling / realtime hors shell
    if (!visible) return

    let cancelled = false
    const supabase = createClient()

    const checkUser = async () => {
      try {
        const {
          data: { user: u },
        } = await supabase.auth.getUser()
        if (cancelled) return
        setUser(u ? { id: u.id } : null)

        if (!u) {
          setUnreadMessages(0)
          setUnreadNotifications(0)
          setCartCount(0)
          setUserType(null)
          return
        }

        const [profileRes, msgRes, notifRes, cartRes] = await Promise.all([
          supabase.from("profiles").select("user_type").eq("id", u.id).maybeSingle(),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .neq("sender_id", u.id),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", u.id)
            .eq("is_read", false),
          supabase
            .from("cart_items")
            .select("id", { count: "exact", head: true })
            .eq("user_id", u.id),
        ])

        if (cancelled) return
        if (profileRes.data) setUserType(profileRes.data.user_type)
        setUnreadMessages(msgRes.count || 0)
        setUnreadNotifications(notifRes.count || 0)
        setCartCount(cartRes.count || 0)
      } catch (err) {
        console.warn("[BottomNav] badges dégradés", err)
      }
    }

    void checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
      if (session?.user) void checkUser()
      else {
        setUnreadMessages(0)
        setUnreadNotifications(0)
        setCartCount(0)
        setUserType(null)
      }
    })

    // Realtime léger — un seul channel notifications ; messages via event custom
    const notificationsChannel = supabase
      .channel("nav-notif-lite")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void checkUser(),
      )
      .subscribe()

    const onNotifUpdated = () => {
      void checkUser()
    }
    window.addEventListener("gwa:notifications-updated", onNotifUpdated)

    // Refresh badges périodique soft (moins agressif que double realtime)
    const interval = window.setInterval(() => void checkUser(), 90_000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      supabase.removeChannel(notificationsChannel)
      window.removeEventListener("gwa:notifications-updated", onNotifUpdated)
      window.clearInterval(interval)
    }
  }, [visible])

  if (!visible) return null

  const isSeller = ["producteur", "cooperative", "transformateur", "entreprise"].includes(
    userType || "",
  )

  const getActiveWorld = (): "social" | "commerce" | "messaging" | "profile" | null => {
    if (pathname === "/" || pathname?.startsWith("/recherche")) return "social"
    if (
      pathname?.startsWith("/marketplace") ||
      pathname?.startsWith("/produit") ||
      pathname?.startsWith("/panier") ||
      pathname?.startsWith("/agriculture")
    )
      return "commerce"
    if (pathname?.startsWith("/messages")) return "messaging"
    if (
      pathname?.startsWith("/profil") ||
      pathname?.startsWith("/notifications") ||
      pathname?.startsWith("/favoris")
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
    { href: "/", icon: Home, label: "Feed", world: "social" },
    {
      href: "/marketplace",
      icon: Store,
      label: "Shop",
      world: "commerce",
      badge: cartCount > 0 ? cartCount : undefined,
    },
    {
      href: isSeller ? "/publier" : "/recherche",
      icon: isSeller ? Plus : Search,
      label: isSeller ? "Publier" : "Explorer",
      world: "social",
      isCenter: true,
    },
    {
      href: "/messages",
      icon: MessageCircle,
      label: "Chat",
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
            "pointer-events-none fixed bottom-[76px] right-3 z-40 flex flex-col items-end gap-2 animate-fadeIn transition-transform duration-300 ease-out",
            scrollHidden && "translate-y-[120%] pointer-events-none opacity-0",
          )}
        >
          {(pathname?.startsWith("/produit/") ||
            pathname?.startsWith("/marketplace/product/")) &&
            cartCount > 0 && (
              <Link
                href="/panier"
                className="pointer-events-auto flex items-center gap-2 bg-[#2F7D32] text-white rounded-full pl-3 pr-4 py-2.5 shadow-lg shadow-[#2F7D32]/25 active:scale-95 transition-transform"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="text-sm font-semibold">{cartCount}</span>
              </Link>
            )}
          {unreadNotifications > 0 && pathname !== "/notifications" && (
            <Link
              href="/notifications"
              className="pointer-events-auto flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-full pl-3 pr-4 py-2.5 shadow-md active:scale-95 transition-transform"
            >
              <Bell className="h-4 w-4 text-[#F39A1F]" />
              <span className="text-xs font-semibold text-[#111827]">{unreadNotifications}</span>
            </Link>
          )}
        </div>
      )}

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out",
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
                        isActive && itemColor ? itemColor.text : "text-[#9CA3AF]",
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
                        : "text-[#9CA3AF]",
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
