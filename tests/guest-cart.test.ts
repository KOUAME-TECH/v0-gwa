import { describe, expect, it, beforeEach } from "vitest"
import {
  addGuestCartItem,
  clearGuestCart,
  loadGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
} from "@/lib/cart/guest"

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
  clearGuestCart()
})

describe("guest cart", () => {
  it("ajoute et incrémente une ligne", () => {
    addGuestCartItem("p1", 2)
    addGuestCartItem("p1", 1)
    expect(loadGuestCart()).toEqual([{ productId: "p1", quantity: 3 }])
  })

  it("fixe la quantité et retire une ligne", () => {
    addGuestCartItem("a", 1)
    addGuestCartItem("b", 2)
    setGuestCartQuantity("a", 5)
    removeGuestCartItem("b")
    expect(loadGuestCart()).toEqual([{ productId: "a", quantity: 5 }])
  })
})
