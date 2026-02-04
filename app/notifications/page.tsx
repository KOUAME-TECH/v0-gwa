"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  Users, MessageSquare, ShoppingBag, Bell, Package, Star, AlertCircle, CheckCheck, ChevronLeft 
} from 'lucide-react'
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link_url: string | null
  is_read: boolean
  created_at: string
}

const notificationIcons: Record<string, any> = {
  order: ShoppingBag,
  message: MessageSquare,
  follow: Users,
  review: Star,
  product: Package,
  alert: AlertCircle,
  default: Bell
}

const notificationColors: Record<string, string> = {
  order: "bg-green-500/10 text-green-600",
  message: "bg-blue-500/10 text-blue-600",
  follow: "bg-purple-500/10 text-purple-600",
  review: "bg-yellow-500/10 text-yellow-600",
  product: "bg-orange-500/10 text-orange-600",
  alert: "bg-red-500/10 text-red-600",
  default: "bg-muted text-muted-foreground"
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    checkUserAndLoadNotifications()
  }, [])

  async function checkUserAndLoadNotifications() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    setUser(currentUser)
    
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (data) setNotifications(data)
    setLoading(false)
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllAsRead() {
    if (!user) return
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const groupedNotifications = notifications.reduce((acc, notif) => {
    const date = new Date(notif.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let key = "Plus ancien"
    if (date.toDateString() === today.toDateString()) key = "Aujourd'hui"
    else if (date.toDateString() === yesterday.toDateString()) key = "Hier"
    else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) key = "Cette semaine"
    
    if (!acc[key]) acc[key] = []
    acc[key].push(notif)
    return acc
  }, {} as Record<string, Notification[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="lg:hidden">
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
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-primary text-sm">
              <CheckCheck className="h-4 w-4 mr-1" />
              Tout lire
            </Button>
          )}
        </div>
      </header>

      {/* Notifications */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Vous recevrez des notifications pour vos commandes, messages et activites
          </p>
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
                {notifs.map(notification => {
                  const Icon = notificationIcons[notification.type] || notificationIcons.default
                  const colorClass = notificationColors[notification.type] || notificationColors.default
                  
                  const content = (
                    <div 
                      key={notification.id} // Added key property here
                      className={`flex items-start gap-3 p-4 transition-colors ${
                        !notification.is_read ? "bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  )

                  return notification.link_url ? (
                    <Link key={notification.id} href={notification.link_url}>
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
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
