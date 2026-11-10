import { describe, expect, it, beforeEach } from "vitest"
import {
  addGuestCartItem,
  clearGuestCart,
  guestCartProductCount,
  loadGuestCart,
  removeGuestCartItem,
  saveGuestCart,
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
  it("adds and increments lines", () => {
    addGuestCartItem("p1", 1)
    addGuestCartItem("p1", 2)
    addGuestCartItem("p2", 1)
    expect(loadGuestCart()).toEqual([
      { productId: "p1", quantity: 3 },
      { productId: "p2", quantity: 1 },
    ])
    expect(guestCartProductCount()).toBe(2)
  })

  it("updates and removes a line", () => {
    addGuestCartItem("p1", 1)
    setGuestCartQuantity("p1", 10)
    expect(loadGuestCart()).toEqual([{ productId: "p1", quantity: 10 }])
    removeGuestCartItem("p1")
    expect(loadGuestCart()).toEqual([])
  })

  it("saves and clears", () => {
    saveGuestCart([{ productId: "a", quantity: 1 }])
    expect(guestCartProductCount()).toBe(1)
    clearGuestCart()
    expect(guestCartProductCount()).toBe(0)
  })
})
