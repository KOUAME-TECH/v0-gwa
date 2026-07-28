"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { Navigation } from "@/components/navigation"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { IncompleteRouteBanner } from "@/components/dev/incomplete-route-banner"
import { AppErrorBoundary } from "@/components/layout/app-error-boundary"
import { YellyProvider } from "@/components/yelly/yelly-provider"
import { Toaster } from "@/components/ui/sonner"
import { shouldShowBottomNav, shouldShowDesktopNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import { startOfflineSyncListener } from "@/lib/offline/sync"

function hydrateA11yPrefs() {
  try {
    if (localStorage.getItem("gwa_large_text") === "1") {
      document.documentElement.classList.add("gwa-large-text")
    }
  } catch {
    /* ignore */
  }
}

/**
 * Shell plein écran — mobile bottom nav, desktop top nav.
 * Desktop/tablette (lg+) : composition capture (top nav + feed 3 col).
 * Téléphone : bottom nav + UI mobile inchangée.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showBottomNav = shouldShowBottomNav(pathname)
  const showDesktopNav = shouldShowDesktopNav(pathname)

  useEffect(() => {
    hydrateA11yPrefs()
    startOfflineSyncListener()
  }, [])

  return (
    <YellyProvider>
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
        <Toaster position="top-center" />
      </div>
    </YellyProvider>
  )
}
