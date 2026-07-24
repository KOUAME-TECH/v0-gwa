import { describe, expect, it, beforeEach } from "vitest"
import {
  feedCacheAgeLabel,
  loadFeedCache,
  saveFeedCache,
} from "@/lib/offline/feed-cache"

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
})

describe("feed-cache offline", () => {
  it("saves and loads items", () => {
    saveFeedCache([
      { type: "product", data: { id: "1", name: "Cacao" } },
      { type: "post", data: { id: "2", content: "Salut" } },
    ])
    const cached = loadFeedCache()
    expect(cached?.items).toHaveLength(2)
    expect(cached?.items[0].type).toBe("product")
    expect(feedCacheAgeLabel(cached!.at)).toMatch(/il y a/)
  })
})
