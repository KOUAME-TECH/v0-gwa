/** À appeler à la déconnexion : vide Cache Storage et demande aux Service Workers de purger. */
export async function purgeClientCaches(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        reg.active?.postMessage({ type: "GWA_LOGOUT" })
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* non bloquant */
  }
}
