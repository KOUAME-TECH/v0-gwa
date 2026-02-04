"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Plus, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/recherche", icon: Search, label: "Explorer" },
  { href: "/publier", icon: Plus, label: "Publier", isMain: true },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/profil", icon: User, label: "Profil" },
]

export function BottomNav() {
  const pathname = usePathname()
  
  // Masquer sur auth et admin
  if (pathname?.startsWith("/auth") || pathname?.startsWith("/admin")) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 safe-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href))
          const Icon = item.icon
          
          // Bouton central vert (commerce/action)
          if (item.isMain) {
            return (
              <Link key={item.href} href={item.href} className="relative -mt-4">
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
              className="flex flex-col items-center gap-1 py-2 px-4 active:opacity-70 transition-opacity"
            >
              <Icon className={cn(
                "h-6 w-6 transition-colors",
                isActive ? "text-[#2F7D32]" : "text-[#4B5563]"
              )} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-[#2F7D32] font-semibold" : "text-[#4B5563]"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
