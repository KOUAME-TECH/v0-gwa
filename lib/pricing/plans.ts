/**
 * Plans abo vendeur GWA — décision DG 28/07/2026.
 */
import {
  FREE_MAX_ACTIVE_LISTINGS,
  SELLER_COMMISSION_RATES,
  SUBSCRIPTION_PRICES_FCFA,
  TIER_LABELS_FR,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"

export type SellerPlan = {
  tier: SubscriptionTier
  label: string
  priceFcfa: number | null
  commissionPct: number
  commissionLabel: string
  headline: string
  benefits: string[]
  cta: string
}

function pctLabel(rate: number): string {
  const pct = rate * 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)} %`
}

export const SELLER_PLANS: SellerPlan[] = [
  {
    tier: "free",
    label: TIER_LABELS_FR.free,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.free,
    commissionPct: SELLER_COMMISSION_RATES.free * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.free),
    headline: "Pour démarrer",
    benefits: [
      `Jusqu’à ${FREE_MAX_ACTIVE_LISTINGS} annonces actives`,
      `Commission ${pctLabel(SELLER_COMMISSION_RATES.free)}`,
      "Digest local + SCG de base",
    ],
    cta: "Plan actuel",
  },
  {
    tier: "starter",
    label: TIER_LABELS_FR.starter,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.starter,
    commissionPct: SELLER_COMMISSION_RATES.starter * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.starter),
    headline: "Producteur actif",
    benefits: [
      "Annonces illimitées",
      `Commission ${pctLabel(SELLER_COMMISSION_RATES.starter)}`,
      "Boost léger + stats simples",
    ],
    cta: "Passer Starter",
  },
  {
    tier: "pro",
    label: TIER_LABELS_FR.pro,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.pro,
    commissionPct: SELLER_COMMISSION_RATES.pro * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.pro),
    headline: "Gros volumes",
    benefits: [
      `Commission ${pctLabel(SELLER_COMMISSION_RATES.pro)}`,
      "Priorité feed / boutique",
      "Priorité file affacturage",
    ],
    cta: "Passer Pro",
  },
  {
    tier: "enterprise",
    label: TIER_LABELS_FR.enterprise,
    priceFcfa: null,
    commissionPct: SELLER_COMMISSION_RATES.enterprise * 100,
    commissionLabel: `≤ ${pctLabel(SELLER_COMMISSION_RATES.enterprise)}`,
    headline: "Coopératives & réseaux",
    benefits: [
      "Multi-gestionnaires",
      "Reporting + account manager",
      "Commission négociée",
    ],
    cta: "Demander un devis",
  },
]

export function planForTier(tier: SubscriptionTier): SellerPlan {
  return SELLER_PLANS.find((p) => p.tier === tier) || SELLER_PLANS[0]
}

export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount)
}
