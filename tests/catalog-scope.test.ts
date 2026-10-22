import { describe, expect, it } from "vitest"
import { isAgriculturalProductType } from "@/lib/catalog/scope"

describe("beta product scope", () => {
  it("accepts agricultural products", () => {
    expect(isAgriculturalProductType("agriculture")).toBe(true)
  })

  it.each(["artisanat", "all", null, undefined, "Agriculture"])(
    "rejects unsupported product types: %s",
    (value) => {
      expect(isAgriculturalProductType(value)).toBe(false)
    },
  )
})
