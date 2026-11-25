import { describe, expect, it } from "vitest"
import { loginSchema, signupSchema } from "@/lib/security/validation"

describe("e-mail : trim avant validation (Zod 4)", () => {
  it("login accepte des espaces autour et normalise", () => {
    const r = loginSchema.safeParse({ email: "  Ama@GWA.ci  ", password: "Motdepasse1!" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe("ama@gwa.ci")
  })
  it("signup accepte des espaces autour et normalise", () => {
    const r = signupSchema.safeParse({
      email: " ama@gwa.ci ",
      password: "Motdepasse1!",
      fullName: "Ama Kouassi",
      role: "buyer",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe("ama@gwa.ci")
  })
  it("rejette toujours un e-mail invalide", () => {
    expect(loginSchema.safeParse({ email: "  pas-un-email ", password: "Motdepasse1!" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "   ", password: "Motdepasse1!" }).success).toBe(false)
  })
})
