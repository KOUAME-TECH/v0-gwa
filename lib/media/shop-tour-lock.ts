/** Verrou global : un Parcours/Digest vocal est en cours (évite cancel TTS des micros). */

let shopTourActive = false
const listeners = new Set<(active: boolean) => void>()

export function setShopTourActive(active: boolean) {
  shopTourActive = active
  try {
    if (active) sessionStorage.setItem("gwa-shop-tour", "1")
    else sessionStorage.removeItem("gwa-shop-tour")
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => {
    try {
      fn(active)
    } catch {
      /* ignore */
    }
  })
}

export function isShopTourActive(): boolean {
  if (shopTourActive) return true
  try {
    return sessionStorage.getItem("gwa-shop-tour") === "1"
  } catch {
    return false
  }
}

export function onShopTourActiveChange(fn: (active: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
