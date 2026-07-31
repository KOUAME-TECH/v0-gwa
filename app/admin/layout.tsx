"use client"

import React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { GwaMark } from "@/components/brand/gwa-mark"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Building2,
  Flag,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  Home,
  Banknote,
  MessageSquare,
  Crown,
  Sparkles,
} from "lucide-react"
import {
  ADMIN_ROLE_LABELS,
  type AdminRole,
  canAccessSection,
  filterNavForRole,
  isAdminRole,
  sectionFromPath,
} from "@/lib/auth/admin-permissions"

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Utilisateurs: Users,
  Produits: Package,
  Commandes: ShoppingCart,
  Cooperatives: Building2,
  Signalements: Flag,
  Support: MessageSquare,
  Litiges: AlertTriangle,
  Verifications: Shield,
  Vérification: Shield,
  "SCG Config": Shield,
  Finances: TrendingUp,
  Affacturage: Banknote,
  Abonnements: Crown,
  "Yelly Ops": Sparkles,
  Statistiques: TrendingUp,
  Parametres: Settings,
}

interface AdminUser {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: AdminRole
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [supportOpenCount, setSupportOpenCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let isMounted = true
    
    const checkAdminAccess = async () => {
      try {
        const supabase = createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!isMounted) return
        
        if (!user) {
          router.push("/auth/login?redirect=/admin")
          return
        }

        const statusRes = await fetch("/api/auth/admin-status")
        const status = await statusRes.json().catch(() => ({}))

        if (!isMounted) return

        if (!status.isAdmin || !isAdminRole(status.role)) {
          router.push("/dashboard")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, email")
          .eq("id", user.id)
          .single()

        if (!isMounted) return

        setAdminUser({
          id: user.id,
          email: user.email || "",
          full_name: profile?.full_name || "Admin",
          avatar_url: profile?.avatar_url,
          role: status.role as AdminRole,
        })

        if (canAccessSection(status.role as AdminRole, "support")) {
          const supportRes = await fetch("/api/admin/support?status=open")
          const supportData = await supportRes.json().catch(() => ({}))
          if (isMounted) {
            setSupportOpenCount(
              Array.isArray(supportData.messages) ? supportData.messages.length : 0,
            )
          }
        }
        
        setLoading(false)
      } catch (error) {
        if (isMounted) setLoading(false)
      }
    }
    
    checkAdminAccess()
    
    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    if (!adminUser) return
    const section = sectionFromPath(pathname)
    if (!canAccessSection(adminUser.role, section)) {
      router.replace("/admin")
    }
  }, [adminUser, pathname, router])

  const navigation = filterNavForRole(adminUser?.role ?? "support")
  const canOpenSettings = adminUser ? canAccessSection(adminUser.role, "settings") : false

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification des accès...</p>
        </div>
      </div>
    )
  }

  if (!adminUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo Harmattan */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <Link href="/admin" className="flex items-center gap-2 min-w-0">
              <GwaMark size={32} showWordmark wordmarkClassName="text-lg text-[#1F5C2E]" />
              <span className="text-xs font-medium text-muted-foreground shrink-0">Admin</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const Icon = NAV_ICONS[item.name] ?? LayoutDashboard
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#2F7D32] text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.name}</span>
                    {item.name === "Support" && supportOpenCount > 0 && (
                      <span
                        className={cn(
                          "min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                          isActive ? "bg-white/25 text-white" : "bg-[#F39A1F] text-white",
                        )}
                      >
                        {supportOpenCount > 99 ? "99+" : supportOpenCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="border-t p-4">
            <Link 
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3"
            >
              <Home className="h-4 w-4" />
              Retour au site
            </Link>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={adminUser.avatar_url || "/placeholder.svg"} />
                <AvatarFallback>{adminUser.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{adminUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{ADMIN_ROLE_LABELS[adminUser.role]}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 bg-card border-b flex items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={adminUser.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback>{adminUser.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block">{adminUser.full_name}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{adminUser.full_name}</span>
                  <span className="text-xs text-muted-foreground font-normal">{adminUser.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canOpenSettings && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Paramètres
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
