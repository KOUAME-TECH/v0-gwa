import { describe, expect, it } from "vitest"
import {
  coopCreateSchema,
  coopJoinSchema,
  coopMemberRoleSchema,
} from "@/lib/cooperatives/create-schema"

describe("coopCreateSchema", () => {
  it("accepte nom + ville", () => {
    const r = coopCreateSchema.safeParse({
      name: "Coop Test",
      city: "Bouake",
    })
    expect(r.success).toBe(true)
  })

  it("refuse nom vide", () => {
    const r = coopCreateSchema.safeParse({ name: "", city: "Abidjan" })
    expect(r.success).toBe(false)
  })

  it("sanitise description HTML", () => {
    const r = coopCreateSchema.safeParse({
      name: "Coop A",
      city: "Yamoussoukro",
      description: "<script>x</script>Bio cacao",
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.description).not.toMatch(/script/i)
      expect(r.data.description).toContain("Bio cacao")
    }
  })
})

describe("coopJoinSchema", () => {
  it("exige uuid", () => {
    expect(coopJoinSchema.safeParse({ coop_id: "x" }).success).toBe(false)
    expect(
      coopJoinSchema.safeParse({
        coop_id: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true)
  })
})

describe("coopMemberRoleSchema", () => {
  it("valide role enum", () => {
    const r = coopMemberRoleSchema.safeParse({
      cooperative_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      role: "manager",
    })
    expect(r.success).toBe(true)
  })
})
