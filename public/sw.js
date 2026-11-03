/* GWA PWA + OneSignal — v22 offline (pass-through auth/maps + sync message listeners) */
/*
 * Chrome requires 'message' (and a few other) SW listeners during the *initial*
 * synchronous evaluation of the worker script. OneSignalSDK.sw.js registers a
 * second message listener inside setTimeout(fn, 0) (source: sw.ts `_listen` /
 * WorkerMessenger.F). Force delay===0 timers to run inline during importScripts
 * so those handlers attach on initial evaluation, then restore setTimeout.
 */
;(function gwaSyncDeferredSwInit() {
  const nativeSetTimeout = self.setTimeout.bind(self)
  self.setTimeout = function gwaSetTimeout(handler, delay) {
    const rest = Array.prototype.slice.call(arguments, 2)
    if (delay === 0 && typeof handler === "function") {
      try {
        handler.apply(undefined, rest)
      } catch (err) {
        console.warn("[GWA SW] deferred OneSignal init", err)
      }
      return 0
    }
    return nativeSetTimeout.apply(undefined, arguments)
  }
  try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")
  } finally {
    self.setTimeout = nativeSetTimeout
  }
})()

/* Top-level message listener (initial evaluation) — skipWaiting + no-op sink */
self.addEventListener("message", (event) => {
  const data = event && event.data
  if (data && (data.type === "SKIP_WAITING" || data === "SKIP_WAITING")) {
    self.skipWaiting()
  }
})

const CACHE = "gwa-v22-offline"
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
  // Claim so offline shell updates apply; fetch handler must pass through
  // cross-origin (Supabase auth, maps) so claim does not break opaque fetches.
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

function shouldPassThrough(url) {
  // Never respondWith cross-origin — avoids breaking Supabase auth, OSM maps,
  // OneSignal CDN, and other opaque / credentialed third-party fetches.
  if (url.origin !== self.location.origin) return true
  if (url.pathname.startsWith("/api/")) return true
  const host = url.hostname
  if (host.endsWith("supabase.co")) return true
  if (host.includes("onesignal.com")) return true
  if (host === "staticmap.openstreetmap.de") return true
  if (host.endsWith("openstreetmap.org") || host.endsWith("openstreetmap.de")) return true
  return false
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  let url
  try {
    url = new URL(event.request.url)
  } catch {
    return
  }

  if (shouldPassThrough(url)) return

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

  // Autre same-origin (JS/CSS Next) : network-first, cache en secours
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
