"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { Navigation } from "@/components/navigation"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { IncompleteRouteBanner } from "@/components/dev/incomplete-route-banner"
import { AppErrorBoundary } from "@/components/layout/app-error-boundary"
import { YellyFab } from "@/components/yelly/yelly-panel"
import { Toaster } from "@/components/ui/sonner"
import { shouldShowBottomNav, shouldShowDesktopNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

/**
 * Shell plein écran — mobile bottom nav, desktop top nav.
 * Pas de cage téléphone ; largeurs contenu gérées par pages / utilitaires CSS.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showBottomNav = shouldShowBottomNav(pathname)
  const showDesktopNav = shouldShowDesktopNav(pathname)

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background gwa-desktop-atmosphere">
      <OfflineBanner offsetForDesktopNav={showDesktopNav} />
      <IncompleteRouteBanner />
      {showDesktopNav ? <Navigation /> : null}
      <AppErrorBoundary>
        <main
          className={cn(
            "flex-1 min-w-0",
            /* Bottom pad mobile only — desktop uses top nav */
            showBottomNav && "pb-[calc(4.75rem+env(safe-area-inset-bottom))] safe-bottom lg:pb-0",
          )}
        >
          {children}
        </main>
      </AppErrorBoundary>
      <BottomNav />
      <YellyFab />
      <Toaster position="top-center" />
    </div>
  )
}
