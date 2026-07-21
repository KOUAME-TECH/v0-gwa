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
 * Shell Harmattan — responsive, aéré.
 * Mobile: pleine largeur. Tablette+: colonne max ~560px centrée (plus spacieux que 480).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showBottomNav = shouldShowBottomNav(pathname)

  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-dvh w-full flex-col bg-background",
        "max-w-none sm:max-w-[560px]",
        "sm:shadow-[0_0_48px_rgba(31,92,46,0.10)] sm:ring-1 sm:ring-black/5",
        "md:min-h-[100dvh]",
      )}
    >
      <OfflineBanner />
      <IncompleteRouteBanner />
      <AppErrorBoundary>
        <main
          className={cn(
            "flex-1 px-0",
            showBottomNav && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] safe-bottom",
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
