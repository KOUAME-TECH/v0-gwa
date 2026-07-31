import { describe, expect, it } from "vitest"
import {
  canAccessSellerStats,
  canPublishAnotherListing,
  canUseYellyToday,
  entitlementsForTier,
  factoringQueuePriority,
  feedPriorityForTier,
  hasProBadge,
  sortByFeedPriority,
  YELLY_GUEST_MAX_PER_DAY,
  yellyDailyLimitForTier,
} from "@/lib/pricing/entitlements"
import { SELLER_PLANS } from "@/lib/pricing/plans"

describe("seller entitlements ↔ services rendus", () => {
  it("Free: 5 annonces, pas de stats, pas de boost", () => {
    const e = entitlementsForTier("free")
    expect(e.maxActiveListings).toBe(5)
    expect(e.simpleStats).toBe(false)
    expect(e.boostScore).toBe(0)
    expect(e.feedPriority).toBe(0)
    expect(e.factoringPriority).toBe(0)
    expect(e.proBadge).toBe(false)
    expect(canAccessSellerStats("free")).toBe(false)
    expect(canPublishAnotherListing("free", 5).ok).toBe(false)
    expect(canPublishAnotherListing("free", 4).ok).toBe(true)
  })

  it("Starter: illimité + stats + boost léger", () => {
    const e = entitlementsForTier("starter")
    expect(e.maxActiveListings).toBeNull()
    expect(e.simpleStats).toBe(true)
    expect(e.boostScore).toBeGreaterThan(0)
    expect(e.feedPriority).toBeGreaterThan(0)
    expect(e.feedPriority).toBeLessThan(50)
    expect(canAccessSellerStats("starter")).toBe(true)
    expect(canPublishAnotherListing("starter", 100).ok).toBe(true)
  })

  it("Pro: priorité feed + affacturage + badge + SCG avancé", () => {
    const e = entitlementsForTier("pro")
    expect(e.feedPriority).toBeGreaterThanOrEqual(50)
    expect(e.factoringPriority).toBeGreaterThanOrEqual(100)
    expect(e.proBadge).toBe(true)
    expect(e.scgAdvanced).toBe(true)
    expect(e.reporting).toBe(true)
    expect(hasProBadge("pro")).toBe(true)
    expect(factoringQueuePriority("pro")).toBeGreaterThan(
      factoringQueuePriority("starter"),
    )
  })

  it("Enterprise: multi-managers + account manager", () => {
    const e = entitlementsForTier("enterprise")
    expect(e.multiManagers).toBe(true)
    expect(e.accountManager).toBe(true)
    expect(e.feedPriority).toBeGreaterThan(feedPriorityForTier("pro"))
  })

  it("Yelly quotas montent avec le palier", () => {
    expect(YELLY_GUEST_MAX_PER_DAY).toBe(3)
    expect(yellyDailyLimitForTier("free")).toBe(10)
    expect(yellyDailyLimitForTier("starter")).toBe(40)
    expect(yellyDailyLimitForTier("pro")).toBe(120)
    expect(yellyDailyLimitForTier("enterprise")).toBeNull()
    expect(canUseYellyToday("free", 10).ok).toBe(false)
    expect(canUseYellyToday("starter", 39).remaining).toBe(1)
    expect(canUseYellyToday("enterprise", 9999).ok).toBe(true)
  })

  it("plans benefits stay honest with entitlements", () => {
    for (const plan of SELLER_PLANS) {
      expect(plan.benefits.length).toBeGreaterThanOrEqual(2)
      expect(plan.benefits.some((b) => /Commission/i.test(b))).toBe(true)
      expect(plan.benefits.some((b) => /Yelly/i.test(b))).toBe(true)
    }
    expect(SELLER_PLANS.find((p) => p.tier === "free")?.benefits.join(" ")).toMatch(
      /5 annonces/i,
    )
    expect(SELLER_PLANS.find((p) => p.tier === "starter")?.benefits.join(" ")).toMatch(
      /illimit/i,
    )
    expect(SELLER_PLANS.find((p) => p.tier === "pro")?.benefits.join(" ")).toMatch(
      /Priorité feed|Badge Pro|affacturage/i,
    )
    expect(SELLER_PLANS.find((p) => p.tier === "free")?.benefits.join(" ")).toMatch(
      /10 requêtes/i,
    )
    expect(SELLER_PLANS.find((p) => p.tier === "enterprise")?.benefits.join(" ")).toMatch(
      /Yelly illimité/i,
    )
  })

  it("sortByFeedPriority puts Pro before Free", () => {
    const sorted = sortByFeedPriority([
      { id: "a", feedPriority: 0, created_at: "2026-01-02T00:00:00Z" },
      { id: "b", feedPriority: 50, created_at: "2026-01-01T00:00:00Z" },
    ])
    expect(sorted[0].id).toBe("b")
  })
})
