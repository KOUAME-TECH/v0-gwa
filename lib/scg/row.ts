import type { SCGDimensions, SCGExplain } from "@/lib/scg/engine"

/** Colonnes 5C de public.scg_scores (migration 085). */
export const SCG_5C_COLUMNS = "c_character, c_capacity, c_capital, c_collateral, c_conditions, model_version"

type Row = {
  c_character?: number | null
  c_capacity?: number | null
  c_capital?: number | null
  c_collateral?: number | null
  c_conditions?: number | null
  explain?: unknown
}

/** Sous-scores 5C d'une ligne scg_scores ; null pour un ancien calcul (avant 5C) → à recalculer. */
export function dimensionsFromRow(row: Row | null | undefined): SCGDimensions | null {
  if (!row || row.c_character == null) return null
  return {
    character: row.c_character ?? 0,
    capacity: row.c_capacity ?? 0,
    capital: row.c_capital ?? 0,
    collateral: row.c_collateral ?? 0,
    conditions: row.c_conditions ?? 0,
  }
}

/** Explication (top 3 hausse / baisse) stockée dans scg_scores.explain. */
export function explainFromRow(row: Row | null | undefined, modelVersion = "5c-v1"): SCGExplain | undefined {
  const e = row?.explain as Partial<SCGExplain> | null | undefined
  if (!e || typeof e !== "object" || !Array.isArray(e.top_up)) return undefined
  return {
    model_version: modelVersion,
    top_up: e.top_up ?? [],
    top_down: e.top_down ?? [],
    caps: e.caps ?? [],
    flags: e.flags ?? [],
    factors: e.factors ?? [],
  }
}
