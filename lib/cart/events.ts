/** Événement panier — rafraîchit badges charette partout. */
export const CART_CHANGED_EVENT = "gwa:cart-changed"

export function notifyCartChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT))
}
