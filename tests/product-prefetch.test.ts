import { describe, expect, it, beforeEach } from "vitest"
import {
  cacheProductPreview,
  readProductPreview,
} from "@/lib/products/prefetch"

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, "sessionStorage", {
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
})

describe("product prefetch cache", () => {
  it("stores and reads product", () => {
    cacheProductPreview({ id: "p1", name: "Cacao", price: 3000 })
    expect(readProductPreview("p1")).toMatchObject({ name: "Cacao", price: 3000 })
  })

  it("returns null for miss", () => {
    expect(readProductPreview("missing")).toBeNull()
  })
})
