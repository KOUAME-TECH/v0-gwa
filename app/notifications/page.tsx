"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Users,
  MessageSquare,
  ShoppingBag,
  Bell,
  Package,
  Star,
  AlertCircle,
  CheckCheck,
  ChevronLeft,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  body?: string | null
  link?: string | null
  link_url?: string | null
  is_read: boolean
  created_at: string
}

const notificationIcons: Record<string, typeof Bell> = {
  order: ShoppingBag,
  message: MessageSquare,
  follow: Users,
  review: Star,
  product: Package,
  alert: AlertCircle,
  default: Bell,
}

const notificationColors: Record<string, string> = {
  order: "bg-green-500/10 text-green-600",
  message: "bg-blue-500/10 text-blue-600",
  follow: "bg-purple-500/10 text-purple-600",
  review: "bg-yellow-500/10 text-yellow-600",
  product: "bg-orange-500/10 text-orange-600",
  alert: "bg-red-500/10 text-red-600",
  default: "bg-muted text-muted-foreground",
}

function notifHref(n: Notification): string | null {
  return n.link || n.link_url || null
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadNotifications()
  }, [])

  async function loadNotifications() {
    const res = await fetch("/api/notifications?limit=50")
    if (res.status === 401) {
      router.replace("/auth/login?redirect=/notifications")
      return
    }
    const data = await res.json().catch(() => ({}))
    setNotifications(data.notifications || [])
    setLoading(false)
  }

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const groupedNotifications = notifications.reduce(
    (acc, notif) => {
      const date = new Date(notif.created_at)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      let key = "Plus ancien"
      if (date.toDateString() === today.toDateString()) key = "Aujourd'hui"
      else if (date.toDateString() === yesterday.toDateString()) key = "Hier"
      else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000))
        key = "Cette semaine"

      if (!acc[key]) acc[key] = []
      acc[key].push(notif)
      return acc
    },
    {} as Record<string, Notification[]>,
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/profil" aria-label="Retour Moi">
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-primary text-sm"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Tout lire
            </Button>
          )}
        </div>
      </header>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Vous recevrez des alertes pour vos commandes, paiements et messages
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/marketplace">
              <Button className="rounded-full">Explorer le marché</Button>
            </Link>
            <Link href="/profil">
              <Button variant="outline" className="rounded-full bg-transparent">
                Retour à Moi
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {Object.entries(groupedNotifications).map(([group, notifs]) => (
            <div key={group}>
              <div className="px-4 py-2 bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group}
                </span>
              </div>
              <div className="divide-y divide-border">
                {notifs.map((notification) => {
                  const Icon =
                    notificationIcons[notification.type] ||
                    notificationIcons.default
                  const colorClass =
                    notificationColors[notification.type] ||
                    notificationColors.default
                  const href = notifHref(notification)

                  const row = (
                    <div
                      className={`flex items-start gap-3 p-4 transition-colors ${
                        !notification.is_read
                          ? "bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (!notification.is_read) void markAsRead(notification.id)
                      }}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm ${
                              !notification.is_read
                                ? "font-semibold"
                                : "font-medium"
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message || notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            { addSuffix: true, locale: fr },
                          )}
                        </p>
                      </div>
                    </div>
                  )

                  return href ? (
                    <Link key={notification.id} href={href}>
                      {row}
                    </Link>
                  ) : (
                    <div key={notification.id}>{row}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
