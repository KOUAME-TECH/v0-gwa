"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, ShoppingBag, MessageCircle, User, Plus, 
  Bell, Search, TrendingUp, Store
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface NavItem {
  href: string
  icon: typeof Home
  activeIcon?: typeof Home
  label: string
  world: "social" | "commerce" | "messaging" | "profile"
  isCenter?: boolean
  badge?: number
}

export function BottomNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  
  useEffect(() => {
    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        const [profileRes, msgRes, notifRes, cartRes] = await Promise.all([
          supabase.from('profiles').select('user_type').eq('id', user.id).single(),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', user.id),
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
          supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        ])
        
        if (profileRes.data) setUserType(profileRes.data.user_type)
        setUnreadMessages(msgRes.count || 0)
        setUnreadNotifications(notifRes.count || 0)
        setCartCount(cartRes.count || 0)
      }
    }
    
    checkUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session?.user) checkUser()
      else {
        setUnreadMessages(0)
        setUnreadNotifications(0)
        setCartCount(0)
      }
    })
    
    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => checkUser())
      .subscribe()
    
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => checkUser())
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(notificationsChannel)
    }
  }, [])
  
  // Masquer sur certaines pages
  if (
    pathname?.startsWith("/auth") || 
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/messages/") ||
    pathname?.startsWith("/profil/edit") ||
    pathname?.startsWith("/dashboard/")
  ) {
    return null
  }

  const isSeller = ["farmer", "artisan", "cooperative", "processor"].includes(userType || "")

  // Determiner le "monde" actif pour le style de fond
  const getActiveWorld = (): "social" | "commerce" | "messaging" | "profile" | null => {
    if (pathname === "/" || pathname?.startsWith("/communaute") || pathname?.startsWith("/recherche") || pathname?.startsWith("/network")) return "social"
    if (pathname?.startsWith("/marketplace") || pathname?.startsWith("/produit") || pathname?.startsWith("/panier") || pathname?.startsWith("/b2b") || pathname?.startsWith("/agriculture") || pathname?.startsWith("/artisans")) return "commerce"
    if (pathname?.startsWith("/messages")) return "messaging"
    if (pathname?.startsWith("/profil") || pathname?.startsWith("/wallet") || pathname?.startsWith("/favoris") || pathname?.startsWith("/notifications")) return "profile"
    return null
  }

  const activeWorld = getActiveWorld()

  // World indicator colors
  const worldColors = {
    social: { bg: "bg-[#F39A1F]", ring: "ring-[#F39A1F]/20", text: "text-[#F39A1F]" },
    commerce: { bg: "bg-[#2F7D32]", ring: "ring-[#2F7D32]/20", text: "text-[#2F7D32]" },
    messaging: { bg: "bg-[#1DA1F2]", ring: "ring-[#1DA1F2]/20", text: "text-[#1DA1F2]" },
    profile: { bg: "bg-[#6B7280]", ring: "ring-[#6B7280]/20", text: "text-[#6B7280]" },
  }

  // 5 tabs: Feed (Social) | Marketplace (Commerce) | [Action] | Messages | Profil
  const navItems: NavItem[] = [
    { 
      href: "/", 
      icon: Home, 
      label: "Feed", 
      world: "social",
    },
    { 
      href: "/marketplace", 
      icon: Store,
      label: "Shop", 
      world: "commerce",
      badge: cartCount > 0 ? cartCount : undefined,
    },
    // Bouton central adaptatif
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
      {/* Floating action pills */}
      {user && (
        <div className="fixed bottom-[76px] right-3 flex flex-col gap-2 z-40 animate-fadeIn">
          {/* Panier flottant si sur page produit */}
          {(pathname?.startsWith("/produit/") || pathname?.startsWith("/marketplace/product/")) && cartCount > 0 && (
            <Link 
              href="/panier"
              className="flex items-center gap-2 bg-[#2F7D32] text-white rounded-full pl-3 pr-4 py-2.5 shadow-lg shadow-[#2F7D32]/25 active:scale-95 transition-transform"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="text-sm font-semibold">{cartCount}</span>
            </Link>
          )}
          {/* Notifications flottantes */}
          {unreadNotifications > 0 && pathname !== "/notifications" && (
            <Link 
              href="/notifications"
              className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-full pl-3 pr-4 py-2.5 shadow-md active:scale-95 transition-transform"
            >
              <Bell className="h-4 w-4 text-[#F39A1F]" />
              <span className="text-xs font-semibold text-[#111827]">{unreadNotifications}</span>
            </Link>
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe" role="navigation" aria-label="Navigation principale">
        {/* World indicator bar */}
        <div className="h-[2px] bg-[#E5E7EB] relative">
          {activeWorld && (
            <div 
              className={cn(
                "absolute top-0 h-full transition-all duration-300 ease-out rounded-full",
                worldColors[activeWorld].bg,
              )}
              style={{
                width: "20%",
                left: activeWorld === "social" ? "0%" 
                    : activeWorld === "commerce" ? "20%" 
                    : activeWorld === "messaging" ? "60%" 
                    : "80%",
              }}
            />
          )}
        </div>

        <div className="bg-white/95 backdrop-blur-lg border-t border-white/50">
          <div className="flex items-center justify-around max-w-lg mx-auto h-[60px] px-1">
            {navItems.map((item) => {
              const isActive = item.href === "/" 
                ? pathname === "/" 
                : pathname?.startsWith(item.href)
              const Icon = item.icon
              const itemColor = isActive ? worldColors[item.world] : null
              
              // Bouton central
              if (item.isCenter) {
                return (
                  <Link 
                    key={item.label} 
                    href={user ? item.href : "/auth/login"} 
                    className="relative -mt-4"
                    aria-label={item.label}
                  >
                    <div className={cn(
                      "w-[52px] h-[52px] rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all duration-200",
                      isSeller 
                        ? "bg-gradient-to-br from-[#2F7D32] to-[#1B5E20] shadow-[#2F7D32]/30" 
                        : "bg-gradient-to-br from-[#F39A1F] to-[#E88A0C] shadow-[#F39A1F]/30",
                    )}>
                      <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className={cn(
                      "text-[9px] font-semibold mt-0.5 block text-center",
                      isSeller ? "text-[#2F7D32]" : "text-[#F39A1F]",
                    )}>
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
                >
                  <div className="relative">
                    <Icon 
                      className={cn(
                        "h-[22px] w-[22px] transition-all duration-200",
                        isActive && itemColor ? itemColor.text : "text-[#9CA3AF]"
                      )} 
                      strokeWidth={isActive ? 2.5 : 1.5}
                      fill={isActive ? "currentColor" : "none"}
                    />
                    
                    {/* Badge */}
                    {item.badge && item.badge > 0 && (
                      <span className={cn(
                        "absolute -top-1.5 -right-2 min-w-[16px] h-[16px] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 animate-bounce-soft",
                        item.world === "messaging" ? "bg-[#1DA1F2]" : item.world === "commerce" ? "bg-[#2F7D32]" : "bg-[#F39A1F]",
                      )}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </div>
                  
                  <span className={cn(
                    "text-[10px] font-medium transition-all duration-200 leading-tight",
                    isActive && itemColor ? cn(itemColor.text, "font-semibold") : "text-[#9CA3AF]"
                  )}>
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
