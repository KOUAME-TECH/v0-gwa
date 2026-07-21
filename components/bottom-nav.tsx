"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageCircle, User, Store, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"

type Tab = {
  href: string
  icon: typeof Home
  label: string
  badge?: number
}

/**
 * Bottom tabs natifs Harmattan — 4 onglets aérés (style Android).
 * Accueil · Marché · Messages · Moi (+ FAB Publier vendeurs).
 */
export function BottomNav() {
  const pathname = usePathname()
  const visible = shouldShowBottomNav(pathname)
  const [userId, setUserId] = useState<string | null>(null)
  const [isSeller, setIsSeller] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const supabase = createClient()

    const refresh = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) {
          setUserId(null)
          setIsSeller(false)
          setUnreadMessages(0)
          setUnreadNotifications(0)
          return
        }
        setUserId(user.id)

        const [profileRes, msgRes, notifRes] = await Promise.all([
          supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle(),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .neq("sender_id", user.id),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false),
        ])
        if (cancelled) return
        const ut = profileRes.data?.user_type || ""
        setIsSeller(["producteur", "cooperative", "transformateur", "entreprise"].includes(ut))
        setUnreadMessages(msgRes.count || 0)
        setUnreadNotifications(notifRes.count || 0)
      } catch (err) {
        console.warn("[BottomNav] badges dégradés", err)
      }
    }

    void refresh()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void refresh())
    const onNotif = () => void refresh()
    window.addEventListener("gwa:notifications-updated", onNotif)
    const interval = window.setInterval(() => void refresh(), 120_000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.removeEventListener("gwa:notifications-updated", onNotif)
      window.clearInterval(interval)
    }
  }, [visible])

  if (!visible) return null

  const tabs: Tab[] = [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/marketplace", icon: Store, label: "Marché" },
    {
      href: "/messages",
      icon: MessageCircle,
      label: "Messages",
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      href: userId ? "/profil" : "/auth/login",
      icon: User,
      label: "Moi",
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
  ]

  return (
    <>
      {isSeller && userId && (
        <Link
          href="/publier"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-2xl bg-[#2F7D32] text-white shadow-lg shadow-[#2F7D32]/35 active:scale-95 transition-transform sm:left-[max(50%,calc(50vw-280px+50%))]"
          style={{ marginLeft: 0 }}
          aria-label="Publier"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[560px] border-t border-[#E8EFE6] bg-[#FFFBF5]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        role="navigation"
        aria-label="Navigation principale"
      >
        <div className="flex h-16 items-stretch justify-around px-2">
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
            const Icon = tab.icon
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  "relative flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 transition-colors active:scale-[0.97]",
                  active ? "text-[#1F5C2E]" : "text-[#8A9A8C]",
                )}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon
                    className="h-6 w-6"
                    strokeWidth={active ? 2.4 : 1.7}
                    fill={active ? "currentColor" : "none"}
                  />
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C27D10] px-1 text-[10px] font-bold text-white">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs leading-none",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {tab.label}
                </span>
                {active && (
                  <span className="absolute bottom-1 h-1 w-6 rounded-full bg-[#1F5C2E]/80" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
