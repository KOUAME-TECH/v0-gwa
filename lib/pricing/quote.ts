/**
 * Modèle économique GWA — deux grilles.
 * Les commandes réelles lisent `pricing_plans` (SQL). Ce module est le même
 * calcul, utilisé par le simulateur, les tests et l'affichage.
 * Franchise inactive si seuil ou plafond vaut 0 (cas COOP_ENTERPRISE : taux seul).
 */

export type PricingTarget = "producer" | "cooperative"

export type PricingPlanInput = {
  name: string
  target: PricingTarget
  monthly_fee: number
  commission_rate: number
  buyer_service_fee_fixed: number
  buyer_service_fee_rate: number
  franchise_threshold: number
  franchise_cap: number
  switch_threshold: number | null
}

export type PricingQuote = {
  product_price: number
  commission_rate_applied: number
  seller_commission: number
  franchise_applied: boolean
  buyer_service_fee: number
  seller_net_amount: number
  total_amount: number
}

export type MarginSimulation = PricingQuote & {
  aggregator_fee: number
  gwa_net_margin: number
  margin_alert: boolean
}

export const PRICING_SEED: PricingPlanInput[] = [
  {
    name: "FREE",
    target: "producer",
    monthly_fee: 0,
    commission_rate: 0.08,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 100_000,
    franchise_cap: 8_000,
    switch_threshold: 250_000,
  },
  {
    name: "STARTER",
    target: "producer",
    monthly_fee: 2_500,
    commission_rate: 0.07,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 200_000,
    franchise_cap: 12_000,
    switch_threshold: 500_000,
  },
  {
    name: "PRO",
    target: "producer",
    monthly_fee: 7_500,
    commission_rate: 0.06,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 500_000,
    franchise_cap: 18_000,
    switch_threshold: null,
  },
  {
    name: "COOP_START",
    target: "cooperative",
    monthly_fee: 5_000,
    commission_rate: 0.06,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 300_000,
    franchise_cap: 12_000,
    switch_threshold: 1_000_000,
  },
  {
    name: "COOP_PRO",
    target: "cooperative",
    monthly_fee: 15_000,
    commission_rate: 0.05,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 1_000_000,
    franchise_cap: 32_000,
    switch_threshold: null,
  },
  {
    name: "COOP_ENTERPRISE",
    target: "cooperative",
    monthly_fee: 0,
    commission_rate: 0.04,
    buyer_service_fee_fixed: 0,
    buyer_service_fee_rate: 0,
    franchise_threshold: 0,
    franchise_cap: 0,
    switch_threshold: null,
  },
]

export function seedPlan(name: string): PricingPlanInput {
  const plan = PRICING_SEED.find((p) => p.name === name)
  if (!plan) throw new Error(`plan inconnu: ${name}`)
  return plan
}

/** Arrondi FCFA (demi supérieur), identique à ROUND() Postgres sur un montant positif. */
export function roundFcfa(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function quotePricing(plan: PricingPlanInput, productPrice: number): PricingQuote {
  const price = roundFcfa(Math.max(0, productPrice))
  const rate = Number(plan.commission_rate) || 0
  const threshold = Number(plan.franchise_threshold) || 0
  const cap = Number(plan.franchise_cap) || 0
  const franchiseApplied = threshold > 0 && cap > 0 && price > threshold
  const sellerCommission = franchiseApplied
    ? roundFcfa(cap)
    : roundFcfa(price * rate)
  const buyerFee = roundFcfa(
    (Number(plan.buyer_service_fee_fixed) || 0) +
      price * (Number(plan.buyer_service_fee_rate) || 0),
  )
  return {
    product_price: price,
    commission_rate_applied: rate,
    seller_commission: sellerCommission,
    franchise_applied: franchiseApplied,
    buyer_service_fee: buyerFee,
    seller_net_amount: price - sellerCommission,
    total_amount: price + buyerFee,
  }
}

export function simulateMargin(
  plan: PricingPlanInput,
  productPrice: number,
  aggregator: { rate: number; fixed: number; alertBelow: number },
): MarginSimulation {
  const quote = quotePricing(plan, productPrice)
  const aggregatorFee = roundFcfa(quote.total_amount * aggregator.rate + aggregator.fixed)
  const gwaNetMargin = quote.seller_commission + quote.buyer_service_fee - aggregatorFee
  return {
    ...quote,
    aggregator_fee: aggregatorFee,
    gwa_net_margin: gwaNetMargin,
    margin_alert: gwaNetMargin < aggregator.alertBelow,
  }
}

export function legacyTierPlanName(
  userType: string | null | undefined,
  tier: string | null | undefined,
): string {
  const coop = userType === "cooperative"
  const t = (tier || "free").toLowerCase()
  if (coop) {
    if (t === "pro" || t === "premium" || t === "plus") return "COOP_PRO"
    if (t === "enterprise" || t === "entreprise" || t === "business" || t === "biz") {
      return "COOP_ENTERPRISE"
    }
    return "COOP_START"
  }
  if (t === "starter" || t === "essentiel" || t === "start") return "STARTER"
  if (t === "pro" || t === "premium" || t === "plus") return "PRO"
  if (t === "enterprise" || t === "entreprise" || t === "business" || t === "biz") {
    return "PRO"
  }
  return "FREE"
}

export function subscriptionTierForPlan(name: string): "free" | "starter" | "pro" | "enterprise" {
  switch (name) {
    case "STARTER":
    case "COOP_START":
      return "starter"
    case "PRO":
    case "COOP_PRO":
      return "pro"
    case "COOP_ENTERPRISE":
      return "enterprise"
    default:
      return "free"
  }
}

export function defaultPlanName(userType: string | null | undefined): string {
  return userType === "cooperative" ? "COOP_START" : "FREE"
}
