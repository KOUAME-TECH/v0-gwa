/* GWA PWA + OneSignal Web Push (même scope /) */
/* OneSignal DOIT être importé en premier — sinon push inopérant */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")

const CACHE = "gwa-v16-onesignal-shell"
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/icon.svg", "/download"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
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
  if (url.pathname.startsWith("/api/")) return
  // Laisser OneSignal / CDN hors cache shell
  if (url.hostname.includes("onesignal.com")) return

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
})
