/**
 * Plans abo vendeur — bénéfices = entitlements réellement délivrés.
 */
import { entitlementsForTier } from "@/lib/pricing/entitlements"
import {
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

function benefitsFor(tier: SubscriptionTier): string[] {
  const e = entitlementsForTier(tier)
  const lines: string[] = []
  if (e.maxActiveListings != null) {
    lines.push(`Jusqu’à ${e.maxActiveListings} annonces actives`)
  } else {
    lines.push("Annonces illimitées")
  }
  lines.push(`Commission ${pctLabel(e.commissionRate)}`)
  if (e.digestLocal) lines.push("Nouveautés locales")
  if (e.scgBasic && !e.scgAdvanced) lines.push("Score de confiance de base")
  if (e.scgAdvanced) lines.push("Score avancé")
  if (e.boostScore > 0 && e.feedPriority < 50) lines.push("Boost léger catalogue")
  if (e.feedPriority >= 50) lines.push("Priorité feed / boutique")
  if (e.simpleStats) lines.push("Stats vendeur")
  if (e.factoringPriority >= 100) lines.push("Priorité file avance sur vente")
  if (e.proBadge) lines.push("Badge Pro GWA")
  if (e.reporting) lines.push("Reporting ventes")
  if (e.multiManagers) lines.push("Multi-gestionnaires")
  if (e.accountManager) lines.push("Account manager (ops)")
  if (e.yellyRequestsPerDay == null) {
    lines.push("Yelly illimité (anti-abus)")
  } else {
    lines.push(`Yelly : ${e.yellyRequestsPerDay} requêtes / jour`)
  }
  return lines
}

export const SELLER_PLANS: SellerPlan[] = [
  {
    tier: "free",
    label: TIER_LABELS_FR.free,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.free,
    commissionPct: SELLER_COMMISSION_RATES.free * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.free),
    headline: "Pour démarrer",
    benefits: benefitsFor("free"),
    cta: "Plan actuel",
  },
  {
    tier: "starter",
    label: TIER_LABELS_FR.starter,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.starter,
    commissionPct: SELLER_COMMISSION_RATES.starter * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.starter),
    headline: "Producteur actif",
    benefits: benefitsFor("starter"),
    cta: "Passer Starter",
  },
  {
    tier: "pro",
    label: TIER_LABELS_FR.pro,
    priceFcfa: SUBSCRIPTION_PRICES_FCFA.pro,
    commissionPct: SELLER_COMMISSION_RATES.pro * 100,
    commissionLabel: pctLabel(SELLER_COMMISSION_RATES.pro),
    headline: "Gros volumes",
    benefits: benefitsFor("pro"),
    cta: "Passer Pro",
  },
  {
    tier: "enterprise",
    label: TIER_LABELS_FR.enterprise,
    priceFcfa: null,
    commissionPct: SELLER_COMMISSION_RATES.enterprise * 100,
    commissionLabel: `≤ ${pctLabel(SELLER_COMMISSION_RATES.enterprise)}`,
    headline: "Coopératives & réseaux",
    benefits: benefitsFor("enterprise"),
    cta: "Demander un devis",
  },
]

export function planForTier(tier: SubscriptionTier): SellerPlan {
  return SELLER_PLANS.find((p) => p.tier === tier) || SELLER_PLANS[0]
}

export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount)
}
