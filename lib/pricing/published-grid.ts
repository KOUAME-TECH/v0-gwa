import type { PricingPlanInput } from "@/lib/pricing/quote"

/**
 * Copie de secours pour les tests et l'affichage si la base ne répond pas.
 * Le paiement réel ne lit pas ce fichier : il lit `pricing_plans`.
 */
export const PRICING_SEED: PricingPlanInput[] = [
  {
    name: "FREE",
    displayName: "Graine",
    target: "producer",
    monthly_fee: 0,
    commission_rate: 0.09,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 133_000,
    franchise_cap: 12_000,
    payout_included: 0,
    switch_threshold: 250_000,
  },
  {
    name: "STARTER",
    displayName: "Pousse",
    target: "producer",
    monthly_fee: 3_000,
    commission_rate: 0.08,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 312_000,
    franchise_cap: 25_000,
    payout_included: 3,
    switch_threshold: 500_000,
  },
  {
    name: "PRO",
    displayName: "Récolte",
    target: "producer",
    monthly_fee: 8_000,
    commission_rate: 0.07,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 642_000,
    franchise_cap: 45_000,
    payout_included: 99,
    switch_threshold: null,
  },
  {
    name: "COOP_START",
    displayName: "Coopérative",
    target: "cooperative",
    monthly_fee: 8_000,
    commission_rate: 0.07,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 500_000,
    franchise_cap: 35_000,
    payout_included: 5,
    switch_threshold: 1_000_000,
  },
  {
    name: "COOP_PRO",
    displayName: "Union",
    target: "cooperative",
    monthly_fee: 20_000,
    commission_rate: 0.06,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 1_000_000,
    franchise_cap: 60_000,
    payout_included: 99,
    switch_threshold: null,
  },
  {
    name: "COOP_ENTERPRISE",
    displayName: "Fédération",
    target: "cooperative",
    monthly_fee: 0,
    commission_rate: 0.05,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 0,
    franchise_cap: 0,
    payout_included: 99,
    switch_threshold: null,
  },
]

export function seedPlan(name: string): PricingPlanInput {
  const plan = PRICING_SEED.find((p) => p.name === name || p.displayName === name)
  if (!plan) throw new Error(`plan inconnu: ${name}`)
  return plan
}
