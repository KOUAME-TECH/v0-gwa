import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { BottomNav } from "@/components/bottom-nav"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "GWA - Green World Agriculture",
  description: "Marketplace et reseau social pour l'agriculture et l'artisanat africain. Achetez, vendez et connectez-vous.",
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
        <main className="pb-20 safe-bottom">{children}</main>
        <BottomNav />
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
