import { describe, expect, it } from "vitest"
import {
  COOP_MIN_ACTIVE_MEMBERS,
  countActiveMembers,
  evaluateCoopQualification,
  hasLegalDocuments,
} from "@/lib/cooperatives/validation-policy"

describe("coop validation policy", () => {
  it("counts active members", () => {
    expect(
      countActiveMembers([
        { is_active: true },
        { is_active: false },
        {},
      ]),
    ).toBe(2)
  })

  it("detects legal docs array", () => {
    expect(hasLegalDocuments([])).toBe(false)
    expect(hasLegalDocuments([{ url: "x" }])).toBe(true)
  })

  it("starts as pending_validation with basic access", () => {
    const r = evaluateCoopQualification({
      createdAt: new Date(),
      activeMemberCount: 1,
      hasLegalDocs: false,
    })
    expect(r.status).toBe("pending_validation")
    expect(r.access).toBe("basic")
    expect(r.membersOk).toBe(false)
  })

  it("marks members_ok when threshold met early", () => {
    const r = evaluateCoopQualification({
      createdAt: new Date(),
      activeMemberCount: COOP_MIN_ACTIVE_MEMBERS,
      hasLegalDocs: false,
    })
    expect(r.membersOk).toBe(true)
    expect(r.status).toBe("members_ok")
    expect(r.access).toBe("standard")
  })

  it("restricts advanced after month 3 without compliance", () => {
    const created = new Date()
    created.setMonth(created.getMonth() - 4)
    const r = evaluateCoopQualification({
      createdAt: created,
      activeMemberCount: 3,
      hasLegalDocs: false,
    })
    expect(r.status).toBe("restricted")
    expect(r.access).toBe("restricted_advanced")
  })

  it("qualifies when members + docs ok", () => {
    const r = evaluateCoopQualification({
      createdAt: new Date(),
      activeMemberCount: 20,
      hasLegalDocs: true,
    })
    expect(r.status).toBe("qualified")
    expect(r.access).toBe("full")
  })
})
