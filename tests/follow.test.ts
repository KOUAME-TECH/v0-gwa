import { describe, it, expect } from "vitest"
import {
  nextFollowState,
  followButtonLabel,
  shouldShowFollowButton,
} from "@/lib/social/follow"

describe("follow helpers", () => {
  it("toggle follow state", () => {
    expect(nextFollowState(false)).toBe("follow")
    expect(nextFollowState(true)).toBe("unfollow")
  })

  it("labels FR", () => {
    expect(followButtonLabel(false)).toBe("Suivre")
    expect(followButtonLabel(true)).toBe("Suivi")
  })

  it("cache le bouton sur son propre contenu", () => {
    expect(shouldShowFollowButton("u1", "u1")).toBe(false)
    expect(shouldShowFollowButton("u1", "u2")).toBe(true)
  })
})
