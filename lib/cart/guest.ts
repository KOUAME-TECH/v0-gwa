/**
 * Panier invité (localStorage) — fusionné à la connexion.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { addOrIncrementCart } from "@/lib/cart/add"
import { notifyCartChanged } from "@/lib/cart/events"

const KEY = "gwa_guest_cart_v1"

export type GuestCartLine = {
  productId: string
  quantity: number
}

export function loadGuestCart(): GuestCartLine[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GuestCartLine[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((l) => l?.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: String(l.productId),
        quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
      }))
  } catch {
    return []
  }
}

export function saveGuestCart(lines: GuestCartLine[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(lines.slice(0, 50)))
    notifyCartChanged()
  } catch {
    /* ignore */
  }
}

export function clearGuestCart(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(KEY)
    notifyCartChanged()
  } catch {
    /* ignore */
  }
}

export function guestCartProductCount(): number {
  return loadGuestCart().length
}

/** Ajoute / incrémente une ligne panier invité. */
export function addGuestCartItem(productId: string, qty = 1): void {
  const amount = Math.max(1, Math.floor(qty))
  const lines = loadGuestCart()
  const idx = lines.findIndex((l) => l.productId === productId)
  if (idx >= 0) {
    lines[idx] = {
      ...lines[idx],
      quantity: lines[idx].quantity + amount,
    }
  } else {
    lines.push({ productId, quantity: amount })
  }
  saveGuestCart(lines)
}

/** Fusionne le panier invité dans le panier Supabase après login. */
export async function mergeGuestCartToUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ merged: number }> {
  const lines = loadGuestCart()
  if (!lines.length) return { merged: 0 }

  let merged = 0
  for (const line of lines) {
    const res = await addOrIncrementCart(supabase, userId, line.productId, line.quantity)
    if (res.ok) merged += 1
  }
  clearGuestCart()
  return { merged }
}
