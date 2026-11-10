import { createClient } from "@supabase/supabase-js"
import type { PricingPlanInput, PricingTarget } from "@/lib/pricing/quote"
import { PRICING_SEED } from "@/lib/pricing/published-grid"

function mapRow(row: Record<string, unknown>): PricingPlanInput | null {
  const name = String(row.code || row.name || "")
  if (!name) return null
  const target = row.target === "cooperative" ? "cooperative" : "producer"
  return {
    name,
    displayName: String(row.name || name),
    target: target as PricingTarget,
    monthly_fee: Number(row.monthly_fee) || 0,
    commission_rate: Number(row.commission_rate) || 0,
    buyer_service_fee_fixed: Number(row.buyer_service_fee_fixed) || 0,
    buyer_service_fee_rate: Number(row.buyer_service_fee_rate) || 0,
    franchise_threshold: Number(row.franchise_threshold) || 0,
    franchise_cap: Number(row.franchise_cap) || 0,
    payout_included: Number(row.payout_included) || 0,
    switch_threshold:
      row.switch_threshold == null ? null : Number(row.switch_threshold),
  }
}

/** Tarifs lus dans `pricing_plans`. La copie locale ne sert que si la base ne répond pas. */
export async function loadPricingPlans(): Promise<PricingPlanInput[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return PRICING_SEED
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase
      .from("pricing_plans")
      .select(
        "code, name, target, monthly_fee, commission_rate, buyer_service_fee_fixed, buyer_service_fee_rate, franchise_threshold, franchise_cap, payout_included, switch_threshold",
      )
      .eq("is_active", true)
    if (error || !data?.length) return PRICING_SEED
    const plans = data.map((row) => mapRow(row)).filter((plan): plan is PricingPlanInput => Boolean(plan))
    return plans.length ? plans : PRICING_SEED
  } catch {
    return PRICING_SEED
  }
}
