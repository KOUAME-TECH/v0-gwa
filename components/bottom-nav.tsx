"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Plus, MessageCircle, User, ShoppingBag, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface NavItem {
  href: string
  icon: typeof Home
  label: string
  isMain?: boolean
  badge?: number
}

export function BottomNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  
  useEffect(() => {
    const supabase = createClient()
    
    // Verifier l'utilisateur connecte
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Compter messages non lus
        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', user.id)
        setUnreadMessages(msgCount || 0)
        
        // Compter notifications non lues
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
        setUnreadNotifications(notifCount || 0)
        
        // Compter articles dans le panier
        const { count: cartItems } = await supabase
          .from('cart_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setCartCount(cartItems || 0)
      }
    }
    
    checkUser()
    
    // Ecouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        checkUser()
      } else {
        setUnreadMessages(0)
        setUnreadNotifications(0)
        setCartCount(0)
      }
    })
    
    // Ecouter les nouveaux messages en temps reel
    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        checkUser()
      })
      .subscribe()
    
    // Ecouter les nouvelles notifications en temps reel
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications' 
      }, () => {
        checkUser()
      })
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(notificationsChannel)
    }
  }, [])
  
  // Masquer sur auth, admin, messages conversation, produit detail, profil edit, checkout
  if (
    pathname?.startsWith("/auth") || 
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/messages/") ||
    pathname?.startsWith("/produit/") ||
    pathname?.startsWith("/marketplace/product/") ||
    pathname?.startsWith("/profil/edit") ||
    pathname?.startsWith("/dashboard/") ||
    pathname?.startsWith("/commandes/") ||
    pathname?.startsWith("/panier")
  ) {
    return null
  }

  const navItems: NavItem[] = [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/recherche", icon: Search, label: "Explorer" },
    { href: "/publier", icon: Plus, label: "Publier", isMain: true },
    { href: "/messages", icon: MessageCircle, label: "Messages", badge: unreadMessages },
    { href: user ? "/profil" : "/auth/login", icon: User, label: user ? "Profil" : "Connexion" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href))
          const Icon = item.icon
          
          // Bouton central vert (publier)
          if (item.isMain) {
            return (
              <Link key={item.href} href={user ? item.href : "/auth/login"} className="relative -mt-5">
                <div className="w-14 h-14 rounded-full bg-[#2F7D32] flex items-center justify-center shadow-lg shadow-[#2F7D32]/30 active:scale-95 transition-transform">
                  <Icon className="h-7 w-7 text-white" strokeWidth={2.5} />
                </div>
              </Link>
            )
          }
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 py-2 px-3 active:opacity-70 transition-opacity min-w-[60px]"
            >
              <div className="relative">
                <Icon className={cn(
                  "h-6 w-6 transition-colors",
                  isActive ? "text-[#2F7D32]" : "text-[#6B7280]"
                )} strokeWidth={isActive ? 2.5 : 1.5} />
                
                {/* Badge pour messages/notifications */}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-[#F39A1F] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-[#2F7D32] font-semibold" : "text-[#6B7280]"
              )}>
                {item.label}
              </span>
              
              {/* Indicateur actif */}
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#2F7D32]" />
              )}
            </Link>
          )
        })}
      </div>
      
      {/* Barre d'acces rapide (panier + notifications) - visible si connecte */}
      {user && (cartCount > 0 || unreadNotifications > 0) && (
        <div className="absolute -top-12 right-4 flex items-center gap-2">
          {cartCount > 0 && (
            <Link 
              href="/panier"
              className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-full px-3 py-1.5 shadow-sm"
            >
              <ShoppingBag className="h-4 w-4 text-[#2F7D32]" />
              <span className="text-xs font-semibold text-[#111827]">{cartCount}</span>
            </Link>
          )}
          {unreadNotifications > 0 && (
            <Link 
              href="/notifications"
              className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-full px-3 py-1.5 shadow-sm"
            >
              <Bell className="h-4 w-4 text-[#F39A1F]" />
              <span className="text-xs font-semibold text-[#111827]">{unreadNotifications}</span>
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
