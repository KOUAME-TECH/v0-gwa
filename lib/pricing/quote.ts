/**
 * Modèle économique GWA — deux grilles.
 * Les commandes réelles lisent `pricing_plans` (SQL). Ce module est le même
 * calcul, utilisé par le simulateur, les tests et l'affichage.
 * Franchise inactive si seuil ou plafond vaut 0 (cas COOP_ENTERPRISE : taux seul).
 */

export type PricingTarget = "producer" | "cooperative"

export type PricingPlanInput = {
  /** Code stable, inchangé pour les clés et les commandes déjà créées. */
  name: string
  /** Nom affiché. Peut changer sans casser les commandes. */
  displayName?: string
  target: PricingTarget
  monthly_fee: number
  commission_rate: number
  buyer_service_fee_fixed: number
  buyer_service_fee_rate: number
  franchise_threshold: number
  franchise_cap: number
  payout_included?: number
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

/** Filtre PostgREST : le code stable ou le nom affiché. */
export function pricingPlanMatchFilter(codeOrName: string): string {
  return `code.eq.${codeOrName},name.eq.${codeOrName}`
}

/** Arrondi FCFA (demi supérieur), identique à ROUND() Postgres sur un montant positif. */
export function roundFcfa(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function quotePricing(
  plan: PricingPlanInput,
  productPrice: number,
  options?: { franchiseSurplusRate?: number | null },
): PricingQuote {
  const price = roundFcfa(Math.max(0, productPrice))
  const rate = Number(plan.commission_rate) || 0
  const threshold = Number(plan.franchise_threshold) || 0
  const cap = Number(plan.franchise_cap) || 0
  const franchiseApplied = threshold > 0 && cap > 0 && price > threshold
  const surplusRate =
    plan.target === "cooperative" ? Math.max(0, Number(options?.franchiseSurplusRate) || 0) : 0
  const sellerCommission = franchiseApplied
    ? roundFcfa(cap) + roundFcfa((price - threshold) * surplusRate)
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
    case "Pousse":
    case "COOP_START":
    case "Coopérative":
      return "starter"
    case "PRO":
    case "Récolte":
    case "COOP_PRO":
    case "Union":
      return "pro"
    case "COOP_ENTERPRISE":
    case "Fédération":
      return "enterprise"
    default:
      return "free"
  }
}

export function defaultPlanName(userType: string | null | undefined): string {
  return userType === "cooperative" ? "COOP_START" : "FREE"
}
