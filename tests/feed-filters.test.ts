import { describe, expect, it } from "vitest"
import {
  FEED_FILTER_CHIPS,
  productMatchesFeedFilter,
} from "@/lib/catalog/feed-filters"

describe("feed-filters", () => {
  it("exposes chips without emoji icons", () => {
    expect(FEED_FILTER_CHIPS.every((c) => !/\p{Extended_Pictographic}/u.test(c.name))).toBe(
      true,
    )
  })

  it("matches category slugs coherently", () => {
    expect(
      productMatchesFeedFilter("cacao", {
        categorySlug: "cacao",
        categoryName: "Cacao",
        productName: "cacao bio",
      }),
    ).toBe(true)
    expect(
      productMatchesFeedFilter("legumes", {
        categorySlug: "legumes",
        productName: "Tomate",
      }),
    ).toBe(true)
    expect(
      productMatchesFeedFilter("epices", {
        categorySlug: "epices",
        productName: "piment",
      }),
    ).toBe(true)
    expect(
      productMatchesFeedFilter("cereales", {
        categorySlug: "cacao",
        productName: "cacao bio",
      }),
    ).toBe(false)
  })

  it("all chip always matches", () => {
    expect(productMatchesFeedFilter("all", { categorySlug: "x" })).toBe(true)
  })
})
