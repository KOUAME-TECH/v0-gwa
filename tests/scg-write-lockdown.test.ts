import { describe, expect, it, vi } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("le test doit injecter un client")
  },
}))

import { persistScgResult } from "@/lib/scg/persist"
import { calculateSCG } from "@/lib/scg/engine"

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe("SCG : écriture serveur uniquement (migration 084)", () => {
  const up = readFileSync("scripts/schema/084_scg_write_lockdown.sql", "utf8")
  const down = readFileSync("scripts/schema/084_scg_write_lockdown.rollback.sql", "utf8")

  it("084 retire la policy d'insertion et les droits d'écriture clients", () => {
    expect(up).toMatch(/DROP POLICY IF EXISTS scg_scores_insert_own ON public\.scg_scores/)
    expect(up).toMatch(
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON public\.scg_scores, public\.scg_history\s+FROM anon, authenticated, PUBLIC/,
    )
    expect(up).not.toMatch(/GRANT[^;]*(INSERT|UPDATE)[^;]*TO (anon|authenticated)/)
    expect(up).toMatch(/NE PAS APPLIQUER/)
  })

  it("084 protège profiles.scg_* à l'INSERT (faille DELETE + INSERT du profil)", () => {
    expect(up).toMatch(/BEFORE INSERT ON public\.profiles/)
    expect(up).toMatch(/SECURITY DEFINER/)
    expect(up).toMatch(/jwt_role IS NULL OR jwt_role = 'service_role'/)
    for (const col of ["scg_score", "scg_badge", "scg_bancable", "scg_calculated_at", "scg_criteria"]) {
      expect(up).toMatch(new RegExp(`NEW\\.${col} :=`))
    }
  })

  it("le rollback rétablit l'état relevé en prod", () => {
    expect(down).toMatch(/DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert/)
    expect(down).toMatch(/CREATE POLICY scg_scores_insert_own ON public\.scg_scores/)
    expect(down).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER/)
  })

  it("aucun code hors lib/scg/persist.ts n'écrit dans scg_scores / scg_history / profiles.scg_*", () => {
    const offenders: string[] = []
    for (const file of [...walk("app"), ...walk("lib"), ...walk("components")]) {
      if (file.endsWith(join("lib", "scg", "persist.ts"))) continue
      const src = readFileSync(file, "utf8")
      if (/from\(\s*["'](scg_scores|scg_history)["']\s*\)\s*\.\s*(insert|update|upsert|delete)/.test(src)) {
        offenders.push(`${file} (table SCG)`)
      }
      for (const m of src.matchAll(/\.(update|insert|upsert)\(\s*\{([^}]*)\}/g)) {
        if (/\bscg_(score|badge|bancable|calculated_at|criteria)\s*:/.test(m[2])) offenders.push(`${file} (profiles.scg_*)`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("callback OAuth, OTP et /api/scg/calculate passent par le helper serveur", () => {
    for (const f of ["app/auth/callback/route.ts", "app/api/auth/verify-otp/route.ts", "app/api/scg/calculate/route.ts"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/ensureInitialScg|persistScgResult/)
    }
    // Serveur uniquement : via lib/supabase/admin (import "server-only").
    expect(readFileSync("lib/scg/persist.ts", "utf8")).toMatch(/from "@\/lib\/supabase\/admin"/)
    expect(readFileSync("lib/supabase/admin.ts", "utf8")).toMatch(/^import "server-only"/)
  })
})

describe("persistScgResult", () => {
  function fakeAdmin(errors: { insert?: string; update?: string } = {}) {
    const calls: { table: string; op: string; payload: unknown; eq?: unknown[] }[] = []
    const client = {
      from(table: string) {
        return {
          insert: async (payload: unknown) => {
            calls.push({ table, op: "insert", payload })
            return { error: errors.insert ? { message: errors.insert } : null }
          },
          update: (payload: unknown) => ({
            eq: async (...eq: unknown[]) => {
              calls.push({ table, op: "update", payload, eq })
              return { error: errors.update ? { message: errors.update } : null }
            },
          }),
        }
      },
    }
    return { client: client as never, calls }
  }

  it("écrit le résultat du moteur (borné à 1000) dans scg_scores puis profiles", async () => {
    const result = calculateSCG({ user_id: "u-1", kyc_verified: true, orders_completed: 10 })
    const { client, calls } = fakeAdmin()
    await persistScgResult("u-1", result, client)
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["scg_scores.insert", "profiles.update"])
    expect(calls[0].payload).toMatchObject({ user_id: "u-1", score_total: result.score_total, bancable: result.bancable })
    expect(calls[1].payload).toMatchObject({ scg_score: result.score_total, scg_bancable: result.bancable })
    expect(calls[1].eq).toEqual(["id", "u-1"])
  })

  it("remonte l'erreur au lieu de l'ignorer, sans toucher au profil", async () => {
    const result = calculateSCG({ user_id: "u-2" })
    const { client, calls } = fakeAdmin({ insert: "permission denied" })
    await expect(persistScgResult("u-2", result, client)).rejects.toThrow(/scg_scores: permission denied/)
    expect(calls).toHaveLength(1)
  })
})
