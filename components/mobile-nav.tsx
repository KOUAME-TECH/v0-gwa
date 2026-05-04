"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Leaf, Palette, ShoppingBag, User, Plus } from 'lucide-react'
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/agriculture", icon: Leaf, label: "Agri" },
  { href: "/artisans", icon: Palette, label: "Artisanat" },
  { href: "/marketplace", icon: ShoppingBag, label: "Shop" },
  { href: "/dashboard", icon: User, label: "Profil", requiresAuth: true },
]

export function MobileNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    
    const checkUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!isMounted) return
        setUser(authUser)

        if (authUser) {
          const { count: cartItems } = await supabase
            .from('cart_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUser.id)
          
          if (!isMounted) return
          setCartCount(cartItems || 0)
        }
      } catch {
        // Ignore errors
      }
    }
    checkUser()
    
    return () => {
      isMounted = false
    }
  }, [pathname])

  const getDashboardRoute = () => {
    if (!user) return "/auth/login"
    return "/dashboard"
  }

  if (pathname?.startsWith('/auth') || pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Floating Action Button */}
      {user && (
        <Link href="/publier">
          <Button
            size="icon"
            className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-xl z-40 md:hidden"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t md:hidden safe-bottom">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname?.startsWith(item.href))
            
            const href = item.requiresAuth && !user 
              ? "/auth/login" 
              : item.href === "/dashboard" 
                ? getDashboardRoute() 
                : item.href

            const showBadge = item.href === "/marketplace" && cartCount > 0

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 touch-target relative",
                  "active:scale-95 transition-all duration-200",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive && "scale-110"
                  )} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive && "font-semibold text-primary"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 bg-primary rounded-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
