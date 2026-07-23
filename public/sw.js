/* GWA PWA + OneSignal — v17 résilient (network-first navigations) */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")

const CACHE = "gwa-v17-resilient"
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/icon.svg"]

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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)

  // API / OneSignal : réseau pur
  if (url.pathname.startsWith("/api/")) return
  if (url.hostname.includes("onesignal.com")) return

  // Navigations HTML : network-first → offline fallback shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(async () => {
          const cached = await caches.match(event.request)
          return cached || caches.match("/") || Response.error()
        }),
    )
    return
  }

  // Assets shell : cache-first
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
