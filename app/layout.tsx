import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { OneSignalProvider } from "@/components/pwa/onesignal-provider"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { AppShell } from "@/components/layout/app-shell"
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/seo/json-ld"
import { WebVitalsReporter } from "@/components/observability/web-vitals"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mygwa.org"),
  title: {
    default: "GWA — La Super App Africaine",
    template: "%s | GWA",
  },
  description:
    "Achetez, vendez, discutez et partagez. Le marketplace social africain qui connecte producteurs, coopératives et acheteurs du monde entier.",
  applicationName: "GWA",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon-32.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GWA",
  },
  openGraph: {
    type: "website",
    locale: "fr_CI",
    siteName: "GWA",
    title: "GWA — La Super App Africaine",
    description:
      "Marketplace social africain : producteurs, coopératives et acheteurs.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "GWA — marque Harmattan (G vert & or)",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GWA — La Super App Africaine",
    description: "Achetez, vendez, discutez — marketplace africain.",
    images: ["/icon-512.png"],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
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
    <html lang="fr">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://frorfexbcyfbydkiwxqv.supabase.co" />
        <link rel="dns-prefetch" href="https://cdn.onesignal.com" />
      </head>
      <body className="font-sans antialiased min-h-dvh bg-background text-foreground">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <OneSignalProvider>
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
          <WebVitalsReporter />
          <Analytics />
        </OneSignalProvider>
      </body>
    </html>
  )
}
