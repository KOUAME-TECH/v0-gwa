"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BarChart3, Package, ShoppingBag, MessageCircle, User, Store, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardNavProps {
  userType?: string
}

export function DashboardNav({ userType }: DashboardNavProps) {
  const pathname = usePathname()
  const isSeller = ["producteur", "artisan", "transformateur"].includes(userType || "")

  const navItems = [
    { href: "/", icon: Home, label: "Feed", color: "text-[#F39A1F]" },
    { href: "/dashboard", icon: BarChart3, label: "Dashboard", color: "text-[#2F7D32]" },
    ...(isSeller 
      ? [{ href: "/dashboard/products", icon: Package, label: "Produits", color: "text-[#2F7D32]" }]
      : [{ href: "/marketplace", icon: Store, label: "Shop", color: "text-[#2F7D32]" }]
    ),
    { href: "/messages", icon: MessageCircle, label: "Chat", color: "text-[#1DA1F2]" },
    { href: "/profil", icon: User, label: "Moi", color: "text-[#6B7280]" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe" role="navigation" aria-label="Navigation dashboard">
      <div className="h-[2px] bg-[#E5E7EB] relative">
        <div className="absolute top-0 h-full bg-[#2F7D32] transition-all duration-300 rounded-full"
          style={{ width: "20%", left: "20%" }}
        />
      </div>
      <div className="bg-white/95 backdrop-blur-lg border-t border-white/50">
        <div className="flex items-center justify-around max-w-lg mx-auto h-[60px] px-1">
          {navItems.map((item) => {
            const isActive = item.href === "/" 
              ? pathname === "/" 
              : pathname?.startsWith(item.href)
            const Icon = item.icon
            
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
                <Icon 
                  className={cn(
                    "h-[22px] w-[22px] transition-all duration-200",
                    isActive ? item.color : "text-[#9CA3AF]"
                  )} 
                  strokeWidth={isActive ? 2.5 : 1.5}
                  fill={isActive ? "currentColor" : "none"}
                />
                <span className={cn(
                  "text-[10px] font-medium transition-all duration-200 leading-tight",
                  isActive ? cn(item.color, "font-semibold") : "text-[#9CA3AF]"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className={cn("absolute -bottom-0.5 w-1 h-1 rounded-full", item.color.replace("text-", "bg-"))} />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
