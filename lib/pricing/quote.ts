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

export { PRICING_SEED, seedPlan } from "@/lib/pricing/published-grid"

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
