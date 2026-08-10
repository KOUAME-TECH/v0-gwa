import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://onesignal.com https://cdn.onesignal.com",
      // unsafe-inline: Next inline + OneSignal SDK. Éviter unsafe-eval (retiré).
      "script-src 'self' 'unsafe-inline' https://cdn.onesignal.com https://onesignal.com https://api.onesignal.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://onesignal.com https://*.onesignal.com https://api.onesignal.com https://api.open-meteo.com https://*.upstash.io https://nominatim.openstreetmap.org https://api.openai.com https://api.groq.com https://*.vercel.app",
      "frame-src 'self' https://www.openstreetmap.org",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "frorfexbcyfbydkiwxqv.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  headers: async () => [
    { source: "/(.*)", headers: securityHeaders },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/OneSignalSDKWorker.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/OneSignalSDKUpdaterWorker.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/manifest.json",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
    },
  ],
  /** Alias legacy — une seule source de vérité pour les redirections */
  redirects: async () => [
    // Alias legacy
    { source: '/profile', destination: '/profil', permanent: true },
    { source: '/artisans', destination: '/agriculture', permanent: true },
    { source: '/artisans/:path*', destination: '/agriculture', permanent: true },
    { source: '/dashboard/artisan', destination: '/dashboard/farmer', permanent: true },
    { source: '/agriculture/produit/:id', destination: '/produit/:id', permanent: true },
    { source: '/marketplace/product/:id', destination: '/produit/:id', permanent: true },
    { source: '/auth/sign-up', destination: '/auth/signup', permanent: true },
    { source: '/auth/sign-up/:path*', destination: '/auth/signup', permanent: true },
    // Liens cassés / alias legacy → pages réelles
    { source: '/legal/terms', destination: '/conditions', permanent: true },
    { source: '/legal/privacy', destination: '/confidentialite', permanent: true },
    { source: '/legal/:path*', destination: '/conditions', permanent: false },
    { source: '/feed', destination: '/', permanent: false },
    // Hors scope bêta F1–F6 (soft-lock) — pages conservées mais inaccessibles
    { source: '/formations', destination: '/', permanent: false },
    { source: '/formations/:path*', destination: '/', permanent: false },
    { source: '/learning', destination: '/', permanent: false },
    { source: '/learning/:path*', destination: '/', permanent: false },
    { source: '/dashboard/student', destination: '/dashboard', permanent: false },
    { source: '/b2b', destination: '/marketplace', permanent: false },
    { source: '/business', destination: '/agriculture', permanent: false },
    { source: '/dashboard/business', destination: '/dashboard/farmer', permanent: false },
    { source: '/network', destination: '/messages', permanent: false },
    { source: '/network/profile/:id', destination: '/profil/:id', permanent: false },
    { source: '/communaute', destination: '/messages', permanent: false },
    { source: '/communaute/:path*', destination: '/messages', permanent: false },
    { source: '/agriculture/producteurs', destination: '/recherche', permanent: false },
    { source: '/agriculture/acheteurs', destination: '/marketplace', permanent: false },
  ],
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: 'gwa-platform',
  project: 'gwa-web',
  hideSourceMaps: true,
  widenClientFileUpload: true,
  disableLogger: true,
})
