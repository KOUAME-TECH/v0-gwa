"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BarChart3, Package, ShoppingBag, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardNavProps {
  userType?: string
}

export function DashboardNav({ userType }: DashboardNavProps) {
  const pathname = usePathname()

  const isSeller = ["producteur", "artisan", "transformateur"].includes(userType || "")

  const navItems = [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
    ...(isSeller 
      ? [{ href: "/dashboard/products", icon: Package, label: "Produits" }]
      : [{ href: "/marketplace", icon: ShoppingBag, label: "Acheter" }]
    ),
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/profil", icon: User, label: "Profil" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href))
          const Icon = item.icon
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 py-2 px-3 active:opacity-70 transition-opacity min-w-[60px]"
            >
              <Icon className={cn(
                "h-6 w-6 transition-colors",
                isActive ? "text-[#2F7D32]" : "text-[#6B7280]"
              )} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-[#2F7D32] font-semibold" : "text-[#6B7280]"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#2F7D32]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
