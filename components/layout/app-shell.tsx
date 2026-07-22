"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { IncompleteRouteBanner } from "@/components/dev/incomplete-route-banner"
import { AppErrorBoundary } from "@/components/layout/app-error-boundary"
import { Toaster } from "@/components/ui/sonner"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

/**
 * Shell plein écran (style PR8) — pas de cage téléphone.
 * Bottom nav dynamique : absente sur coopératives, auth, etc.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showBottomNav = shouldShowBottomNav(pathname)

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background">
      <OfflineBanner />
      <IncompleteRouteBanner />
      <AppErrorBoundary>
        <main
          className={cn(
            "flex-1",
            showBottomNav && "pb-[calc(4.75rem+env(safe-area-inset-bottom))] safe-bottom",
          )}
        >
          {children}
        </main>
      </AppErrorBoundary>
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  )
}
