import { describe, expect, it } from "vitest"
import {
  canAssignCoopRoles,
  canChangeMemberRole,
  canInviteMembers,
  canManageCoop,
  isCoopManagerRole,
  roleBadgeLabel,
} from "@/lib/cooperatives/roles"

describe("coop multi-gestionnaires", () => {
  it("admin et manager gèrent la coop ; membre non", () => {
    expect(canManageCoop("admin")).toBe(true)
    expect(canManageCoop("manager")).toBe(true)
    expect(canManageCoop("member")).toBe(false)
    expect(isCoopManagerRole("manager")).toBe(true)
  })

  it("seuls les admins assignent les rôles", () => {
    expect(canAssignCoopRoles("admin")).toBe(true)
    expect(canAssignCoopRoles("manager")).toBe(false)
    expect(canInviteMembers("manager")).toBe(true)
  })

  it("empêche de retirer le dernier admin", () => {
    const blocked = canChangeMemberRole({
      actorRole: "admin",
      targetCurrentRole: "admin",
      targetNewRole: "manager",
      targetIsSelf: true,
      adminCount: 1,
    })
    expect(blocked.ok).toBe(false)

    const ok = canChangeMemberRole({
      actorRole: "admin",
      targetCurrentRole: "admin",
      targetNewRole: "manager",
      targetIsSelf: true,
      adminCount: 2,
    })
    expect(ok.ok).toBe(true)
  })

  it("labels lisibles", () => {
    expect(roleBadgeLabel("manager")).toBe("Gestionnaire")
    expect(roleBadgeLabel("admin")).toBe("Administrateur")
  })
})
