import { describe, expect, it, beforeEach } from "vitest"
import {
  clearCartSnapshot,
  loadCartSnapshot,
  saveCartSnapshot,
} from "@/lib/offline/cart-snapshot"

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    },
  })
  clearCartSnapshot()
})

describe("cart-snapshot offline", () => {
  it("saves and loads for same user", () => {
    saveCartSnapshot("u1", [
      {
        id: "c1",
        quantity: 2,
        product: { id: "p1", name: "Cacao", price: 1000, unit: "kg", images: null },
      },
    ])
    const snap = loadCartSnapshot("u1")
    expect(snap?.lines).toHaveLength(1)
    expect(snap?.lines[0].product.name).toBe("Cacao")
    expect(loadCartSnapshot("u2")).toBeNull()
  })
})
