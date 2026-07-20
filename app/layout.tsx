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
  themeColor: "#2F7D32",
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
      <body className="font-sans antialiased min-h-dvh">
        <OneSignalProvider>
          <ServiceWorkerRegister />
          <OfflineBanner />
          <IncompleteRouteBanner />
          <main className="pb-[76px] safe-bottom">{children}</main>
          <BottomNav />
          <Toaster position="top-center" />
          <Analytics />
        </OneSignalProvider>
      </body>
    </html>
  )
}
