/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self), payment=(self)' },
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
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.onesignal.com https://onesignal.com https://api.onesignal.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://onesignal.com https://*.onesignal.com https://api.onesignal.com https://api.open-meteo.com https://*.upstash.io",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
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
    optimizePackageImports: ["lucide-react", "date-fns", "@radix-ui/react-icons"],
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

export default nextConfig
