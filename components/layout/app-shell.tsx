"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { IncompleteRouteBanner } from "@/components/dev/incomplete-route-banner"
import { AppErrorBoundary } from "@/components/layout/app-error-boundary"
import { Toaster } from "@/components/ui/sonner"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showBottomNav = shouldShowBottomNav(pathname)

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-[0_0_48px_rgba(31,92,46,0.12)] md:min-h-[100dvh] md:ring-1 md:ring-black/5">
      <OfflineBanner />
      <IncompleteRouteBanner />
      <AppErrorBoundary>
        <main
          className={cn(
            "flex-1",
            showBottomNav && "pb-[76px] safe-bottom",
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
