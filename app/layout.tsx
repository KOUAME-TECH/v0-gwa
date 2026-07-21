import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { BottomNav } from "@/components/bottom-nav"
import { Toaster } from "@/components/ui/sonner"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { OneSignalProvider } from "@/components/pwa/onesignal-provider"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { IncompleteRouteBanner } from "@/components/dev/incomplete-route-banner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "GWA - La Super App Africaine",
  description: "Achetez, vendez, discutez et partagez. Le marketplace social africain qui connecte producteurs, coopératives et acheteurs du monde entier.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GWA",
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1F5C2E",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased min-h-dvh bg-[#E8EFE6] md:bg-[radial-gradient(ellipse_at_top,#F3F7F0_0%,#D5E3D2_45%,#C5D4C2_100%)]">
        <OneSignalProvider>
          <ServiceWorkerRegister />
          <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-[0_0_48px_rgba(31,92,46,0.12)] md:min-h-[100dvh] md:ring-1 md:ring-black/5">
            <OfflineBanner />
            <IncompleteRouteBanner />
            <main className="flex-1 pb-[76px] safe-bottom">{children}</main>
            <BottomNav />
            <Toaster position="top-center" />
          </div>
          <Analytics />
        </OneSignalProvider>
      </body>
    </html>
  )
}
