import type { Metadata, Viewport } from "next"
import { Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { OneSignalProvider } from "@/components/pwa/onesignal-provider"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { AppShell } from "@/components/layout/app-shell"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

export const metadata: Metadata = {
  title: "GWA - La Super App Africaine",
  description:
    "Achetez, vendez, discutez et partagez. Le marketplace social africain qui connecte producteurs, coopératives et acheteurs du monde entier.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GWA",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#1F5C2E",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={outfit.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://frorfexbcyfbydkiwxqv.supabase.co" />
        <link rel="dns-prefetch" href="https://cdn.onesignal.com" />
      </head>
      <body className="font-sans antialiased min-h-dvh bg-background text-foreground">
        <OneSignalProvider>
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
          <Analytics />
        </OneSignalProvider>
      </body>
    </html>
  )
}
