/* GWA PWA + OneSignal — v21 offline (OneSignal + shell) (navigations + shell + fallback) */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")

const CACHE = "gwa-v21-offline"
const SHELL = [
  "/",
  "/marketplace",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/apple-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((u) => cache.add(u).catch(() => undefined))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

async function offlineFallback(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const url = new URL(request.url)
  if (url.pathname.startsWith("/marketplace") || url.pathname.startsWith("/produit/")) {
    const shop = await caches.match("/marketplace")
    if (shop) return shop
  }
  if (url.pathname.startsWith("/publier")) {
    const home = await caches.match("/")
    if (home) return home
  }

  return (
    (await caches.match("/offline.html")) ||
    (await caches.match("/")) ||
    new Response("Hors ligne", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  )
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)

  // API / OneSignal : réseau pur
  if (url.pathname.startsWith("/api/")) return
  if (url.hostname.includes("onesignal.com")) return

  // Navigations HTML : network-first → cache page → offline.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => offlineFallback(event.request)),
    )
    return
  }

  // Assets shell / images locales : cache-first
  const isShellAsset = SHELL.some(
    (p) => url.pathname === p || url.pathname.endsWith(p.replace(/^\//, "")),
  )
  if (isShellAsset || url.pathname.match(/\.(png|svg|ico|webp|woff2?)$/i)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok && url.origin === self.location.origin) {
              const clone = response.clone()
              caches.open(CACHE).then((cache) => cache.put(event.request, clone))
            }
            return response
          }),
      ),
    )
    return
  }

  // Autre (JS/CSS Next) : network-first, cache en secours
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((c) => c || Response.error())),
  )
})
