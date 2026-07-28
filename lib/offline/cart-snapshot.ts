/**
 * Snapshot panier connecté pour lecture hors-ligne.
 */
const KEY = "gwa_cart_snapshot_v1"
const MAX_AGE_MS = 1000 * 60 * 60 * 48 // 48 h

export type CartSnapshotLine = {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    unit: string
    images: string[] | null
    product_type?: string
    seller_id?: string
    profiles?: {
      full_name?: string | null
      city?: string | null
      country?: string | null
    } | null
  }
}

type CartSnapshot = {
  at: number
  userId: string
  lines: CartSnapshotLine[]
}

export function saveCartSnapshot(userId: string, lines: CartSnapshotLine[]): void {
  if (typeof localStorage === "undefined") return
  try {
    const payload: CartSnapshot = {
      at: Date.now(),
      userId,
      lines: lines.slice(0, 40),
    }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function loadCartSnapshot(userId: string): CartSnapshot | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CartSnapshot
    if (!parsed?.at || parsed.userId !== userId || !Array.isArray(parsed.lines)) {
      return null
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function clearCartSnapshot(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
