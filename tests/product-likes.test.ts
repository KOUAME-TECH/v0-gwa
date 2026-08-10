import { describe, expect, it } from "vitest"
import {
  formatLikesBadge,
  likeButtonLabel,
  nextLikesCount,
  normalizeLikesCount,
} from "@/lib/products/likes"

describe("product likes helpers", () => {
  it("normalizeLikesCount clamps invalid values", () => {
    expect(normalizeLikesCount(undefined)).toBe(0)
    expect(normalizeLikesCount(null)).toBe(0)
    expect(normalizeLikesCount(-3)).toBe(0)
    expect(normalizeLikesCount(4.7)).toBe(4)
    expect(normalizeLikesCount("12")).toBe(12)
  })

  it("nextLikesCount toggles safely", () => {
    expect(nextLikesCount(0, true)).toBe(1)
    expect(nextLikesCount(5, false)).toBe(4)
    expect(nextLikesCount(0, false)).toBe(0)
  })

  it("formatLikesBadge is compact", () => {
    expect(formatLikesBadge(0)).toBe("")
    expect(formatLikesBadge(42)).toBe("42")
    expect(formatLikesBadge(1200)).toBe("1.2k")
    expect(formatLikesBadge(10000)).toBe("10k")
  })

  it("likeButtonLabel is accessible FR", () => {
    expect(likeButtonLabel(false, 0)).toBe("J'aime")
    expect(likeButtonLabel(true, 3)).toContain("n'aime plus")
    expect(likeButtonLabel(false, 8)).toContain("8")
  })
})
