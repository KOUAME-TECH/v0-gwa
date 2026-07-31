import { describe, expect, it } from "vitest"
import {
  adminAiDailyLimit,
  adminAiEntitlements,
  canRunAdminAiTask,
  canUseAdminAiToday,
} from "@/lib/admin/ai-entitlements"

describe("admin AI quotas by role", () => {
  it("moderator: 40/j, moderation + support only", () => {
    expect(adminAiDailyLimit("moderator")).toBe(40)
    expect(canRunAdminAiTask("moderator", "moderation")).toBe(true)
    expect(canRunAdminAiTask("moderator", "factoring")).toBe(false)
    expect(canUseAdminAiToday("moderator", 40).ok).toBe(false)
  })

  it("support: 60/j, disputes ok, factoring no", () => {
    expect(adminAiDailyLimit("support")).toBe(60)
    expect(canRunAdminAiTask("support", "dispute_summary")).toBe(true)
    expect(canRunAdminAiTask("support", "factoring")).toBe(false)
  })

  it("admin: 120/j, all tasks", () => {
    expect(adminAiDailyLimit("admin")).toBe(120)
    expect(canRunAdminAiTask("admin", "coop")).toBe(true)
    expect(canUseAdminAiToday("admin", 119).remaining).toBe(1)
  })

  it("super_admin: unlimited", () => {
    expect(adminAiDailyLimit("super_admin")).toBeNull()
    expect(canUseAdminAiToday("super_admin", 9999).ok).toBe(true)
    expect(adminAiEntitlements("super_admin").canSuggestFactoring).toBe(true)
  })
})
