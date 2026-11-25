import { describe, expect, it, vi } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }))

import { applySelfRoleChoice, normalizeSelfRole, PRIVILEGED_PROFILE_FIELDS } from "@/lib/profile/privileged"

const SQL = readFileSync("scripts/schema/086_profile_privileged_fields_lockdown.sql", "utf8")
const ROLLBACK = readFileSync("scripts/schema/086_profile_privileged_fields_lockdown.rollback.sql", "utf8")

function assigned(block: string): string[] {
  return [...block.matchAll(/NEW\.(\w+)\s*:=/g)].map((m) => m[1])
}

describe("086 — migration", () => {
  const insertBlock = SQL.slice(SQL.indexOf("IF TG_OP = 'INSERT' THEN"), SQL.indexOf("-- UPDATE"))
  const updateBlock = SQL.slice(SQL.indexOf("-- UPDATE"), SQL.indexOf("REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields"))

  it("INSERT et UPDATE couvrent exactement la liste des champs privilégiés", () => {
    expect(assigned(insertBlock).sort()).toEqual([...PRIVILEGED_PROFILE_FIELDS].sort())
    expect(assigned(updateBlock).filter((f) => f !== "id").sort()).toEqual([...PRIVILEGED_PROFILE_FIELDS].sort())
    for (const f of PRIVILEGED_PROFILE_FIELDS) expect(updateBlock).toContain(`NEW.${f}`.padEnd(0) + "")
  })

  it("inventaire : rôle, KYC, suspension, abonnement, réputation, SCG", () => {
    for (const f of ["user_type", "sub_type", "coop_id", "is_verified", "rccm_verified", "phone_verified", "is_suspended", "subscription_tier", "subscription_expires_at", "pricing_plan_id", "rating", "total_reviews", "scg_score", "scg_bancable"]) {
      expect(PRIVILEGED_PROFILE_FIELDS).toContain(f)
    }
  })

  it("trigger unique BEFORE INSERT OR UPDATE, search_path fixé, contexte sans JWT jamais NULL", () => {
    expect(SQL).toMatch(/CREATE TRIGGER trg_0_protect_profile_privileged\s+BEFORE INSERT OR UPDATE ON public\.profiles/)
    expect(SQL).toMatch(/DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public\.profiles/)
    expect(SQL).toMatch(/DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert ON public\.profiles/)
    expect((SQL.match(/SET search_path = public, pg_temp/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(SQL).toMatch(/IN \('anon', 'authenticated'\),\s*false\s*\)/)
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.protect_profile_privileged_fields\(\) FROM PUBLIC, anon, authenticated/)
    expect(SQL).toMatch(/REVOKE TRUNCATE, REFERENCES, TRIGGER ON public\.profiles FROM anon, authenticated, PUBLIC/)
    expect(SQL).toMatch(/BEFORE INSERT ON public\.verification_requests/)
    expect(SQL).toMatch(/NEW\.status\s+:= 'pending'/)
  })

  it("rollback : restaure le trigger UPDATE d'origine et celui de 084", () => {
    expect(ROLLBACK).toMatch(/DROP TRIGGER IF EXISTS trg_0_protect_profile_privileged/)
    expect(ROLLBACK).toMatch(/CREATE TRIGGER trg_protect_profile_privileged\s+BEFORE UPDATE ON public\.profiles/)
    expect(ROLLBACK).toMatch(/protect_profile_scg_on_insert/)
    expect(ROLLBACK).toMatch(/DROP FUNCTION IF EXISTS public\.protect_verification_request_insert/)
  })
})

describe("choix du rôle en libre-service (serveur)", () => {
  it("combinaisons autorisées", () => {
    expect(normalizeSelfRole({ sub_type: "producteur_individuel" })).toEqual({ user_type: "producteur", sub_type: "producteur_individuel" })
    expect(normalizeSelfRole({ sub_type: "cooperative", user_type: "cooperative" })).toEqual({ user_type: "cooperative", sub_type: "cooperative" })
    expect(normalizeSelfRole({ user_type: "acheteur" })).toEqual({ user_type: "acheteur", sub_type: null })
    expect(normalizeSelfRole({ user_type: "producteur" })).toEqual({ user_type: "producteur", sub_type: null })
  })

  it("combinaisons refusées", () => {
    for (const bad of [{ user_type: "cooperative" }, { user_type: "admin" }, { sub_type: "cooperative", user_type: "acheteur" }, { sub_type: "x" }, {}, { user_type: 1 }]) {
      expect(normalizeSelfRole(bad as never)).toHaveProperty("error")
    }
  })

  function fakeAdmin(current: { user_type: string | null; sub_type: string | null } | null) {
    const updates: Record<string, unknown>[] = []
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }),
        update: (p: Record<string, unknown>) => ({ eq: async () => (updates.push(p), { error: null }) }),
      }),
    }
    return { admin: admin as never, updates }
  }

  it("premier choix (sous-type vide) : écrit par le service role", async () => {
    const { admin, updates } = fakeAdmin({ user_type: "acheteur", sub_type: null })
    expect(await applySelfRoleChoice("u", { sub_type: "producteur_individuel", user_type: "producteur" }, admin)).toEqual({ ok: true, changed: true })
    expect(updates[0]).toMatchObject({ user_type: "producteur", sub_type: "producteur_individuel" })
  })

  it("rôle déjà choisi : identique → rien ; différent → 409, aucune écriture", async () => {
    const same = fakeAdmin({ user_type: "producteur", sub_type: "producteur_individuel" })
    expect(await applySelfRoleChoice("u", { user_type: "producteur" }, same.admin)).toEqual({ ok: true, changed: false })
    const diff = fakeAdmin({ user_type: "producteur", sub_type: "producteur_individuel" })
    expect(await applySelfRoleChoice("u", { sub_type: "cooperative" }, diff.admin)).toMatchObject({ status: 409 })
    expect(same.updates.length + diff.updates.length).toBe(0)
  })

  it("profil absent → 404", async () => {
    expect(await applySelfRoleChoice("u", { user_type: "acheteur" }, fakeAdmin(null).admin)).toMatchObject({ status: 404 })
  })
})

describe("code : aucune écriture de champ privilégié avec la session du membre", () => {
  const files: string[] = []
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      if (["node_modules", ".next", "tests", "scripts", "public"].includes(n)) continue
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(n)) files.push(p)
    }
  }
  for (const d of ["app", "lib", "components", "hooks"]) {
    try { walk(d) } catch { /* dossier absent */ }
  }

  const ADMIN_RECEIVER = /(admin|gate\.admin|createAdminClient\(\))\s*$/

  function payloadText(src: string, start: number): string {
    // Texte de l'argument de update/insert/upsert (parenthèses équilibrées)
    let depth = 0
    let i = start
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++
      else if (src[i] === ")") { depth--; if (depth === 0) break }
    }
    return src.slice(start + 1, i)
  }

  function resolve(src: string, text: string, seen = new Set<string>()): string {
    let out = text
    const ids = [...text.matchAll(/(?:^\s*|\.\.\.)([A-Za-z_]\w*)\s*(?:,|$|\})/gm)].map((m) => m[1])
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const def = src.match(new RegExp(`(?:const|let)\\s+${id}(?:\\s*:[^=]+)?\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))
      if (def) out += "\n" + resolve(src, def[1], seen)
      for (const m of src.matchAll(new RegExp(`${id}\\.(\\w+)\\s*=`, "g"))) out += `\n${m[1]}:`
    }
    return out
  }

  it("toutes les écritures user-client vers profiles n'ont que des champs autorisés", () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      const re = /([\w.()]+)\s*\.from\(["']profiles["']\)\s*\.(update|insert|upsert)\s*\(/g
      for (const m of src.matchAll(re)) {
        const receiver = src.slice(Math.max(0, m.index! - 40), m.index! + m[1].length)
        if (ADMIN_RECEIVER.test(receiver)) continue
        const text = resolve(src, payloadText(src, m.index! + m[0].length - 1))
        for (const field of PRIVILEGED_PROFILE_FIELDS) {
          if (new RegExp(`(^|[\\s{,])${field}\\s*:`).test(text) || new RegExp(`\\.${field}\\s*=`).test(text)) {
            offenders.push(`${f}: ${field}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("OTP, lien email, onboarding et inscription passent par le serveur", () => {
    const otp = readFileSync("app/api/auth/verify-otp/route.ts", "utf8")
    expect(otp).not.toMatch(/supabase\s*\.from\("profiles"\)/)
    expect(otp).toMatch(/applySelfRoleChoice/)
    const link = readFileSync("app/api/auth/link-email/route.ts", "utf8")
    expect(link).toMatch(/await admin\s*\.from\("profiles"\)\s*\.update\(profileUpdate\)/)
    const patch = readFileSync("app/api/profiles/[id]/route.ts", "utf8")
    expect(patch).toMatch(/applySelfRoleChoice\(id, \{ user_type: body\.user_type, sub_type: body\.sub_type \}\)/)
    const signup = readFileSync("app/auth/signup/page.tsx", "utf8")
    expect(signup).toMatch(/body: JSON\.stringify\(\{ user_type: mappedType \}\)/)
  })
})
