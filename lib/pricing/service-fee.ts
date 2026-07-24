/**
 * Frais de service GWA selon le niveau d’abonnement (profiles.subscription_tier).
 * Plus l’abo est élevé, plus le % baisse.
 */

export type SubscriptionTier =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise"

/** Taux (fraction, ex. 0.02 = 2 %) par palier. */
export const SERVICE_FEE_RATES: Record<SubscriptionTier, number> = {
  free: 0.025,
  starter: 0.02,
  pro: 0.01,
  business: 0.005,
  enterprise: 0.003,
}

export const TIER_LABELS_FR: Record<SubscriptionTier, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Entreprise",
}

export function normalizeSubscriptionTier(
  raw: string | null | undefined,
): SubscriptionTier {
  const t = (raw || "free").toLowerCase().trim()
  if (t === "free" || t === "gratuit" || t === "basic" || t === "libre" || t === "") {
    return "free"
  }
  if (t === "starter" || t === "essentiel" || t === "start") return "starter"
  if (t === "pro" || t === "premium" || t === "plus") return "pro"
  if (t === "business" || t === "biz" || t === "team") return "business"
  if (t === "enterprise" || t === "entreprise" || t === "corp") return "enterprise"
  return "free"
}

export function serviceFeeRateForTier(
  tier: string | null | undefined,
): number {
  return SERVICE_FEE_RATES[normalizeSubscriptionTier(tier)]
}

/** Calcule les frais de service (arrondi FCFA). */
export function computeServiceFee(
  subtotal: number,
  tier: string | null | undefined,
): { fee: number; rate: number; tier: SubscriptionTier; pctLabel: string } {
  const normalized = normalizeSubscriptionTier(tier)
  const rate = SERVICE_FEE_RATES[normalized]
  const base = Math.max(0, Number(subtotal) || 0)
  const fee = Math.round(base * rate)
  const pctLabel = `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)} %`
  return { fee, rate, tier: normalized, pctLabel }
}
