import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { clampScg, formatScg, scgRatio, SCG_BANCABLE_MIN, SCG_MAX, SCG_MIN } from "@/lib/scg/scale"
import { calculateSCG, getBadge, getRecommandation } from "@/lib/scg/engine"
import { SCG_EXPLANATION, scgLevel } from "@/lib/scg/explain"
import { FACTORING_MIN_SCORE } from "@/lib/factoring/eligibility"
import { YELLY_SYSTEM_PROMPT } from "@/lib/yelly/prompt"

describe("échelle SCG 0 à 1000 (directive de Yao)", () => {
  it("bornes et helpers", () => {
    expect([SCG_MIN, SCG_MAX]).toEqual([0, 1000])
    expect(clampScg(1500)).toBe(1000)
    expect(clampScg(-20)).toBe(0)
    expect(clampScg(209.6)).toBe(210)
    expect(clampScg(null)).toBe(0)
    expect(clampScg(Number.NaN)).toBe(0)
    expect(clampScg(Number.POSITIVE_INFINITY)).toBe(0)
    expect(scgRatio(250)).toBe(0.25)
    expect(scgRatio(4000)).toBe(1)
    expect(formatScg(209)).toBe("209 / 1000")
    expect(formatScg(99999)).toBe("1000 / 1000")
  })

  it("le moteur ne dépasse jamais 1000, même avec des entrées extrêmes", () => {
    const max = calculateSCG(
      {
        user_id: "u-test",
        account_age_days: 99_999,
        kyc_verified: true,
        rccm_verified: true,
        phone_verified: true,
        email_present: true,
        reviews_count: 10_000,
        reviews_avg: 50,
        orders_completed: 10_000,
        msgs_received: 1000,
        msgs_replied_48h: 1000,
        gmv_12m_fcfa: 1e12,
        orders_completed_12m: 10_000,
        active_months_12m: 999,
        distinct_buyers: 999,
        top_buyer_share: 0.01,
        gmv_prev_150d_fcfa: 1e13,
        revenue_total_fcfa: 1e12,
        stock_value_fcfa: 1e12,
        surface_ha: 9999,
        storage_or_vehicle: true,
        activity_start_year: 1960,
        escrow_held_fcfa: 1e12,
        receivables_fcfa: 1e12,
        coop_member: true,
        coop_verified: true,
        gps_parcels: 99,
        certifications: 99,
        main_filiere: "cacao",
        filieres_count: 5,
        country_supported: true,
        region_known: true,
        price_gap_pct: 0,
      },
      new Date("2026-11-25T12:00:00Z"),
    )
    expect(max.score_total).toBeLessThanOrEqual(1000)
    expect(max.score_total).toBeGreaterThanOrEqual(900)
    expect(max.badge).toBe("excellence")
    expect(max.bancable).toBe(true)

    const empty = calculateSCG({ user_id: "u-vide" })
    expect(empty.score_total).toBeGreaterThanOrEqual(0)
    expect(empty.bancable).toBe(false)
  })

  it("seuils cohérents : badge, bancable, affacturage, recommandation", () => {
    expect(getBadge(1000).id).toBe("excellence")
    expect(SCG_BANCABLE_MIN).toBe(500)
    expect(FACTORING_MIN_SCORE).toBe(SCG_BANCABLE_MIN)
    // Un profil bancable (≥ 500) n'est plus décrit comme « intermédiaire ».
    const dims = { character: 80, capacity: 30, capital: 60, collateral: 50, conditions: 35 }
    expect(getRecommandation(550, dims)).toMatch(/^Profil bancable — /)
    expect(getRecommandation(750, dims)).toMatch(/^Profil bancable solide/)
    expect(getRecommandation(499, dims)).not.toMatch(/bancable/)
  })

  it("profil : l'explication et les paliers parlent de 0 à 1000", () => {
    expect(SCG_EXPLANATION).toMatch(/0 à 1000/)
    expect(SCG_EXPLANATION).not.toMatch(/0 à 100\b/)
    expect(scgLevel(209)?.label).toBe("Débutant")
    expect(scgLevel(800)?.label).toBe("Excellent")
  })

  it("UI et textes : « X / 1000 » partout, plus aucune échelle sur 100 pour le score global", () => {
    const profil = readFileSync("app/profil/profil-screen.tsx", "utf8")
    expect(profil).toMatch(/formatScg\(scgScore\)/)
    expect(profil).toMatch(/aria-valuemax=\{SCG_MAX\}/)
    expect(profil).not.toMatch(/\}\/100 ·/)
    expect(readFileSync("components/scg/scg-display.tsx", "utf8")).toMatch(/\/ \{SCG_MAX\}/)
    expect(readFileSync("app/affacturage/page.tsx", "utf8")).toMatch(/formatScg\(profile\?\.scg_score\)/)
    expect(readFileSync("app/aide/page.tsx", "utf8")).toMatch(/0 à 1000/)
    expect(readFileSync("app/conditions/page.tsx", "utf8")).toMatch(/0 à 1000/)
    expect(YELLY_SYSTEM_PROMPT).toMatch(/0 à 1000/)
  })
})

describe("migration 083_scg_max_1000 (non appliquée)", () => {
  const up = readFileSync("scripts/schema/083_scg_max_1000.sql", "utf8")
  const down = readFileSync("scripts/schema/083_scg_max_1000.rollback.sql", "utf8")

  it("CHECK 0–1000 sur toutes les colonnes de score SCG", () => {
    for (const [table, col] of [
      ["profiles", "scg_score"],
      ["scg_scores", "score_total"],
      ["scg_history", "score_total"],
      ["factoring_requests", "scg_score_snapshot"],
    ]) {
      expect(up).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ADD CONSTRAINT \\w+ CHECK \\(${col} BETWEEN 0 AND 1000\\) NOT VALID`))
    }
    expect(up.match(/VALIDATE CONSTRAINT/g)).toHaveLength(4)
    expect(up).toMatch(/NE PAS APPLIQUER/)
    expect(up).toMatch(/RAISE EXCEPTION/)
  })

  it("aucune conversion active (seulement en commentaire) et rollback complet", () => {
    const active = up.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
    expect(active).not.toMatch(/\bUPDATE\b/)
    for (const c of [
      "profiles_scg_score_range",
      "scg_scores_score_total_range",
      "scg_history_score_total_range",
      "factoring_requests_scg_score_snapshot_range",
    ]) {
      expect(up).toContain(c)
      expect(down).toMatch(new RegExp(`DROP CONSTRAINT IF EXISTS ${c}`))
    }
  })
})
