/* GWA SW core — v23 private network-only (partagé par sw.js et les workers OneSignal) */

const CACHE = "gwa-v23-offline"
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

// Pages liées à un compte : jamais en cache (v23 : + notifications, favoris, factures, publier, abonnement, scg)
const PRIVATE_PREFIXES = [
  "/profil",
  "/admin",
  "/dashboard",
  "/wallet",
  "/messages",
  "/panier",
  "/commandes",
  "/notifications",
  "/favoris",
  "/facture",
  "/publier",
  "/abonnement",
  "/scg",
  "/auth",
]

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

function hasAuthRequestHeaders(request) {
  if (request.headers.get("Authorization")) return true
  const cookie = request.headers.get("Cookie") || ""
  return /(?:^|;\s*)(sb-[^=]+-auth-token(?:\.[0-9]+)?)=/i.test(cookie)
}

function isAuthenticatedResponse(response) {
  if (response.headers.has("Set-Cookie")) return true
  const cc = (response.headers.get("Cache-Control") || "").toLowerCase()
  return /\bprivate\b|\bno-store\b/.test(cc)
}

function shouldBypassCache(request, response) {
  const url = new URL(request.url)
  if (isPrivatePath(url.pathname)) return true
  if (request.mode === "navigate" && hasAuthRequestHeaders(request)) return true
  if (response && isAuthenticatedResponse(response)) return true
  return false
}

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
  const url = new URL(request.url)
  if (isPrivatePath(url.pathname)) {
    return (
      (await caches.match("/offline.html")) ||
      new Response("Hors ligne", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    )
  }

  const cached = await caches.match(request)
  if (cached) return cached

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

function networkOnly(request) {
  return fetch(request).catch(() =>
    request.mode === "navigate" ? offlineFallback(request) : Response.error(),
  )
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)

  // API / OneSignal : réseau pur
  if (url.pathname.startsWith("/api/")) return
  if (url.hostname.includes("onesignal.com")) return

  // Pages privées et navigations authentifiées : network-only, jamais de cache
  if (shouldBypassCache(event.request)) {
    event.respondWith(networkOnly(event.request))
    return
  }

  // Navigations HTML : network-first → cache page → offline.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            url.origin === self.location.origin &&
            !shouldBypassCache(event.request, response)
          ) {
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
            if (
              response.ok &&
              url.origin === self.location.origin &&
              !shouldBypassCache(event.request, response)
            ) {
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
        if (
          response.ok &&
          url.origin === self.location.origin &&
          !shouldBypassCache(event.request, response)
        ) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((c) => c || Response.error())),
  )
})
