import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import {
  computeFiveC,
  logScale,
  normalizeFiliere,
  NEUTRAL_RATIO,
  PILLAR_META,
  PILLAR_WEIGHTS,
  type ScgInputs,
} from "@/lib/scg/five-c"
import { calculateSCG } from "@/lib/scg/engine"
import { dimensionsFromRow, explainFromRow } from "@/lib/scg/row"
import { pillarSentence } from "@/lib/scg/explain"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }))

const NOW = new Date("2026-11-25T12:00:00Z") // novembre : saison cacao

/** Producteur de cacao établi, identité vérifiée, ventes régulières. */
const solid: ScgInputs = {
  user_id: "u-solid",
  account_age_days: 500,
  kyc_verified: true,
  phone_verified: true,
  email_present: true,
  reviews_count: 8,
  reviews_avg: 4.6,
  orders_total: 24,
  orders_completed: 22,
  orders_cancelled: 1,
  orders_late: 2,
  disputes_total: 1,
  msgs_received: 40,
  msgs_replied_48h: 36,
  gmv_12m_fcfa: 3_500_000,
  orders_completed_12m: 20,
  active_months_12m: 10,
  gmv_30d_fcfa: 300_000,
  gmv_prev_150d_fcfa: 1_500_000,
  distinct_buyers: 6,
  top_buyer_share: 0.35,
  buyer_tranches_due: 4,
  buyer_tranches_late: 0,
  revenue_total_fcfa: 5_000_000,
  stock_value_fcfa: 800_000,
  surface_ha: 4,
  activity_start_year: 2012,
  escrow_held_fcfa: 400_000,
  receivables_fcfa: 600_000,
  coop_member: true,
  coop_verified: true,
  gps_parcels: 1,
  certifications: 1,
  main_filiere: "Cacao",
  filieres_count: 2,
  country_supported: true,
  region_known: true,
  price_gap_pct: 6,
}

const empty: ScgInputs = { user_id: "u-empty", account_age_days: 400, country_supported: true }

describe("SCG 5C — structure", () => {
  it("5 piliers, poids documentés qui totalisent 100 %", () => {
    expect(PILLAR_META.map((m) => m.key)).toEqual(["character", "capacity", "capital", "collateral", "conditions"])
    expect(Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
    expect(PILLAR_WEIGHTS).toEqual({ character: 25, capacity: 25, capital: 15, collateral: 20, conditions: 15 })
  })

  it("chaque pilier : facteurs dont le maximum totalise 100", () => {
    const r = computeFiveC(solid, NOW)
    for (const m of PILLAR_META) {
      const max = r.factors.filter((f) => f.pillar === m.key).reduce((s, f) => s + f.max, 0)
      expect(max, m.key).toBe(100)
    }
  })

  it("total = Σ pilier × poids × 10, borné 0–1000", () => {
    const r = computeFiveC(solid, NOW)
    const expected = Math.round(
      (r.pillars.character * 25 + r.pillars.capacity * 25 + r.pillars.capital * 15 + r.pillars.collateral * 20 + r.pillars.conditions * 15) / 10,
    )
    expect(r.score_total).toBe(expected)
    expect(r.score_total).toBeGreaterThanOrEqual(600)
    expect(r.score_total).toBeLessThanOrEqual(1000)
    for (const v of Object.values(r.pillars)) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of Object.values(r.pillars)) expect(v).toBeLessThanOrEqual(100)
    expect(r.bancable).toBe(true)
    expect(r.caps).toEqual([])
  })
})

describe("SCG 5C — données manquantes : neutre prudent, jamais de bonus", () => {
  it("profil vide : score bas, non bancable, aucun pilier au-dessus de 50", () => {
    const r = computeFiveC({ user_id: "x" }, NOW)
    expect(r.score_total).toBeLessThan(200)
    expect(r.bancable).toBe(false)
    for (const v of Object.values(r.pillars)) expect(v).toBeLessThanOrEqual(50)
  })

  it("un facteur « qualité » absent vaut 40 % de son maximum, moins que de bons avis", () => {
    const none = computeFiveC({ ...solid, reviews_count: 0, reviews_avg: null }, NOW)
    const f = none.factors.find((x) => x.key === "reviews")!
    expect(f.status).toBe("missing")
    expect(f.points).toBeCloseTo(f.max * NEUTRAL_RATIO)
    expect(none.pillars.character).toBeLessThan(computeFiveC(solid, NOW).pillars.character)
  })

  it("de mauvais avis font moins que l'absence d'avis (pas de prime à l'opacité inverse non plus)", () => {
    const bad = computeFiveC({ ...solid, reviews_count: 10, reviews_avg: 1.2 }, NOW)
    const none = computeFiveC({ ...solid, reviews_count: 0, reviews_avg: null }, NOW)
    expect(bad.factors.find((x) => x.key === "reviews")!.points).toBeLessThan(
      none.factors.find((x) => x.key === "reviews")!.points,
    )
  })

  it("une preuve absente (KYC, ventes, garanties) vaut 0", () => {
    const r = computeFiveC(empty, NOW)
    for (const k of ["kyc", "sales_volume", "sales_count", "escrow", "coop", "parcels", "revenue_total"]) {
      expect(r.factors.find((f) => f.key === k)!.points, k).toBe(0)
    }
  })

  it("filière inconnue : risque prudent (12/30), pas le meilleur", () => {
    const r = computeFiveC({ ...solid, main_filiere: "autre" }, NOW)
    expect(r.factors.find((f) => f.key === "sector")!.points).toBe(12)
  })
})

describe("SCG 5C — plafonds anti-fraude et prudence", () => {
  it("identité non vérifiée : plafond 499, pas bancable", () => {
    const r = computeFiveC({ ...solid, kyc_verified: false }, NOW)
    expect(r.score_total).toBeLessThanOrEqual(499)
    expect(r.bancable).toBe(false)
    expect(r.top_down[0].pillar).toBe("cap")
  })

  it("compte de moins de 90 jours : plafond 499", () => {
    const r = computeFiveC({ ...solid, account_age_days: 30 }, NOW)
    expect(r.score_total).toBeLessThanOrEqual(499)
    expect(r.bancable).toBe(false)
  })

  it("compte suspendu : plafond 199 ; signalement confirmé : plafond 299", () => {
    expect(computeFiveC({ ...solid, is_suspended: true }, NOW).score_total).toBeLessThanOrEqual(199)
    expect(computeFiveC({ ...solid, reports_upheld: 1 }, NOW).score_total).toBeLessThanOrEqual(299)
  })

  it("auto-transactions / comptes liés : capacité ≤ 60, drapeau, jamais bancable", () => {
    for (const k of ["self_orders", "linked_orders", "self_reviews"] as const) {
      const r = computeFiveC({ ...solid, [k]: 2 }, NOW)
      expect(r.pillars.capacity, k).toBeLessThanOrEqual(60)
      expect(r.flags).toContain("self_dealing")
      expect(r.bancable).toBe(false)
    }
  })

  it("ventes concentrées sur un seul acheteur : capacité ≤ 50", () => {
    const r = computeFiveC({ ...solid, distinct_buyers: 1, top_buyer_share: 1 }, NOW)
    expect(r.pillars.capacity).toBeLessThanOrEqual(50)
    expect(r.flags).toContain("concentration")
  })

  it("pic de volume soudain : capacité ≤ 60", () => {
    const r = computeFiveC({ ...solid, gmv_30d_fcfa: 3_000_000, gmv_prev_150d_fcfa: 500_000 }, NOW)
    expect(r.pillars.capacity).toBeLessThanOrEqual(60)
    expect(r.flags).toContain("volume_spike")
  })

  it("incidents (litiges perdus, retards de paiement) font baisser le Caractère", () => {
    const r = computeFiveC({ ...solid, disputes_lost: 2, buyer_tranches_late: 2 }, NOW)
    expect(r.pillars.character).toBeLessThan(computeFiveC(solid, NOW).pillars.character)
    expect(r.factors.find((f) => f.key === "incidents")!.status).toBe("penalty")
  })

  it("créances déjà affacturées ne comptent pas deux fois", () => {
    const r = computeFiveC({ ...solid, factoring_outstanding_fcfa: 600_000 }, NOW)
    expect(r.factors.find((f) => f.key === "receivables")!.points).toBe(0)
  })

  it("entrées extrêmes : jamais au-dessus de 1000 ni d'un pilier à 100", () => {
    const r = computeFiveC(
      { ...solid, gmv_12m_fcfa: 1e15, revenue_total_fcfa: 1e15, reviews_avg: 99, active_months_12m: 99, certifications: 99 },
      NOW,
    )
    expect(r.score_total).toBeLessThanOrEqual(1000)
    for (const v of Object.values(r.pillars)) expect(v).toBeLessThanOrEqual(100)
  })
})

describe("SCG 5C — explicabilité", () => {
  it("3 facteurs qui montent (impacts positifs décroissants) et 3 qui baissent (négatifs)", () => {
    const r = computeFiveC(solid, NOW)
    expect(r.top_up).toHaveLength(3)
    expect(r.top_down).toHaveLength(3)
    expect(r.top_up.every((e) => e.impact > 0)).toBe(true)
    expect(r.top_down.every((e) => e.impact < 0)).toBe(true)
    expect([...r.top_up].sort((a, b) => b.impact - a.impact)).toEqual(r.top_up)
    expect([...r.top_down].sort((a, b) => a.impact - b.impact)).toEqual(r.top_down)
    for (const e of [...r.top_up, ...r.top_down]) expect(e.sentence.length).toBeGreaterThan(10)
  })

  it("la somme des impacts des facteurs reconstitue le score (sans plafond)", () => {
    const r = computeFiveC(solid, NOW)
    const sum = r.factors.reduce((s, f) => s + (f.points * PILLAR_WEIGHTS[f.pillar]) / 10, 0)
    expect(Math.abs(sum - r.score_total)).toBeLessThanOrEqual(3)
  })

  it("phrases simples par pilier selon le niveau", () => {
    expect(pillarSentence("character", 80)).toMatch(/confiance/)
    expect(pillarSentence("capacity", 10)).toMatch(/ventes/)
  })
})

describe("SCG 5C — Conditions", () => {
  it("saisonnalité : cacao en novembre > cacao en septembre", () => {
    const nov = computeFiveC(solid, NOW).factors.find((f) => f.key === "season")!.points
    const sep = computeFiveC(solid, new Date("2026-09-15T12:00:00Z")).factors.find((f) => f.key === "season")!.points
    expect(nov).toBeGreaterThan(sep)
  })

  it("prix : écart faible au prix de référence > écart fort", () => {
    const near = computeFiveC({ ...solid, price_gap_pct: 5 }, NOW).factors.find((f) => f.key === "price")!.points
    const far = computeFiveC({ ...solid, price_gap_pct: 60 }, NOW).factors.find((f) => f.key === "price")!.points
    expect(near).toBeGreaterThan(far)
  })

  it("normalisation des filières", () => {
    expect(normalizeFiliere("Cacao")).toBe("cacao")
    expect(normalizeFiliere("Café robusta")).toBe("cafe")
    expect(normalizeFiliere("noix de cajou")).toBe("anacarde")
    expect(normalizeFiliere("Hévéa")).toBe("hevea")
    expect(normalizeFiliere("autre")).toBeNull()
    expect(normalizeFiliere(null)).toBeNull()
  })

  it("échelle logarithmique monotone et bornée", () => {
    expect(logScale(0, 1_000_000, 30)).toBe(0)
    expect(logScale(100_000, 1_000_000, 30)).toBeLessThan(logScale(500_000, 1_000_000, 30))
    expect(logScale(1_000_000, 1_000_000, 30)).toBeCloseTo(30)
    expect(logScale(1e12, 1_000_000, 30)).toBe(30)
  })
})

describe("SCG 5C — moteur, lecture des lignes, collecte serveur", () => {
  it("calculateSCG expose les 5C, le badge et l'explication", () => {
    const r = calculateSCG(solid, NOW)
    expect(Object.keys(r.dimensions)).toEqual(["character", "capacity", "capital", "collateral", "conditions"])
    expect(r.explain?.model_version).toBe("5c-v1")
    expect(r.explain?.top_up.length).toBe(3)
    expect(["confirme", "excellence"]).toContain(r.badge)
    expect(r.recommandation).toMatch(/bancable/)
  })

  it("dimensionsFromRow : ancienne ligne (avant 5C) → null ; nouvelle → 5 piliers", () => {
    expect(dimensionsFromRow({ c_character: null })).toBeNull()
    expect(dimensionsFromRow(null)).toBeNull()
    expect(
      dimensionsFromRow({ c_character: 1, c_capacity: 2, c_capital: 3, c_collateral: 4, c_conditions: 5 }),
    ).toEqual({ character: 1, capacity: 2, capital: 3, collateral: 4, conditions: 5 })
    expect(explainFromRow({ explain: {} })).toBeUndefined()
    expect(explainFromRow({ explain: { top_up: [], top_down: [] } })?.top_up).toEqual([])
  })

  it("collecte : un seul appel RPC scg_5c_inputs (service role), erreur remontée", async () => {
    const { aggregateProducerData } = await import("@/lib/scg/aggregate")
    const rpc = vi.fn(async () => ({ data: { kyc_verified: true }, error: null }))
    const out = await aggregateProducerData("u-9", { rpc } as never)
    expect(rpc).toHaveBeenCalledWith("scg_5c_inputs", { p_user: "u-9" })
    expect(out).toEqual({ kyc_verified: true, user_id: "u-9" })
    const failing = { rpc: async () => ({ data: null, error: { message: "permission denied" } }) }
    await expect(aggregateProducerData("u-9", failing as never)).rejects.toThrow(/scg_5c_inputs: permission denied/)
  })

  it("persist écrit les 5C et l'explication", async () => {
    const { persistScgResult } = await import("@/lib/scg/persist")
    const calls: { table: string; payload: Record<string, unknown> }[] = []
    const admin = {
      from: (table: string) => ({
        insert: async (payload: Record<string, unknown>) => (calls.push({ table, payload }), { error: null }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => (calls.push({ table, payload }), { error: null }),
        }),
      }),
    }
    const r = calculateSCG(solid, NOW)
    await persistScgResult("u-solid", r, admin as never)
    expect(calls[0].payload).toMatchObject({
      model_version: "5c-v1",
      c_character: r.dimensions.character,
      c_capacity: r.dimensions.capacity,
      c_capital: r.dimensions.capital,
      c_collateral: r.dimensions.collateral,
      c_conditions: r.dimensions.conditions,
    })
    expect((calls[0].payload.explain as { top_up: unknown[] }).top_up).toHaveLength(3)
    expect(calls[1].payload).toMatchObject({ scg_criteria: { model: "5c-v1", character: r.dimensions.character } })
  })
})

describe("SCG 5C — migration 085, UI, textes, documentation", () => {
  const sql = readFileSync("scripts/schema/085_scg_5c.sql", "utf8")
  const rollback = readFileSync("scripts/schema/085_scg_5c.rollback.sql", "utf8")

  it("085 : fonction d'entrée SECURITY DEFINER réservée au service role, colonnes bornées", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.scg_5c_inputs\(p_user uuid\)/)
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/STABLE/)
    expect(sql).toMatch(/SET search_path = public/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.scg_5c_inputs\(uuid\) FROM PUBLIC, anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.scg_5c_inputs\(uuid\) TO service_role/)
    expect(sql).not.toMatch(/GRANT[^;]*TO (anon|authenticated)/)
    expect(sql).toMatch(/scg_scores_5c_range/)
    for (const c of ["c_character", "c_capacity", "c_capital", "c_collateral", "c_conditions", "explain", "model_version"]) {
      expect(sql).toContain(c)
      expect(rollback).toContain(c)
    }
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS public\.scg_5c_inputs\(uuid\)/)
    // Aucune écriture dans la fonction (lecture seule) et pas de contenu de message lu
    const body = sql.slice(sql.indexOf("@@SCG_5C_INPUTS_BEGIN@@"), sql.indexOf("@@SCG_5C_INPUTS_END@@"))
    expect(body).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/)
    expect(body).not.toMatch(/\bcontent\b/)
  })

  it("UI : page /scg et profil affichent les 5C (barres + phrases) et « X / 1000 »", () => {
    const page = readFileSync("app/scg/page.tsx", "utf8")
    expect(page).toMatch(/ScgDimensions/)
    expect(page).toMatch(/ScgFactors/)
    expect(page).toMatch(/Caractère 25 %/)
    const profil = readFileSync("app/profil/profil-screen.tsx", "utf8")
    expect(profil).toMatch(/<ScgDimensions dimensions=\{scgDims\} compact \/>/)
    expect(profil).toMatch(/formatScg\(scgScore\)/)
    const display = readFileSync("components/scg/scg-display.tsx", "utf8")
    expect(display).toMatch(/pillarSentence/)
    expect(display).toMatch(/Ce qui fait monter ton score/)
  })

  it("FAQ, CGU et Yelly parlent des 5C", () => {
    expect(readFileSync("app/aide/page.tsx", "utf8")).toMatch(/5C/)
    const cgu = readFileSync("app/conditions/page.tsx", "utf8")
    expect(cgu).toMatch(/5C/)
    expect(cgu).toMatch(/Caractère \(25 %\)/)
    expect(cgu).toMatch(/valeur neutre et\s+prudente/)
    expect(readFileSync("lib/yelly/prompt.ts", "utf8")).toMatch(/5C/)
  })

  it("docs/scg-5c.md : définitions, poids, sources, limites, seuils", () => {
    const doc = readFileSync("docs/scg-5c.md", "utf8")
    for (const s of ["Caractère", "Capacité", "Capital", "Garanties", "Conditions", "25 %", "15 %", "20 %", "500", "800", "Limites", "Sources", "scg_5c_inputs"]) {
      expect(doc, s).toContain(s)
    }
  })

  it("plus aucune trace des anciennes dimensions v1 dans le code applicatif", () => {
    for (const f of [
      "app/scg/page.tsx",
      "app/api/scg/[profileId]/route.ts",
      "app/api/admin/scg/route.ts",
      "app/dashboard/farmer/page.tsx",
      "app/admin/scg/page.tsx",
      "lib/scg/persist.ts",
      "lib/scg/coach.ts",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/dim_fiabilite|fiabilite:/)
    }
  })
})
