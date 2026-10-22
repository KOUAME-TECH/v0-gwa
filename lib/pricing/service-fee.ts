/**
 * Commission vendeur GWA — décision DG 28/07/2026.
 * Acheteur retail : 0 frais GWA. Commission prélevée côté vendeur selon son palier.
 * GeniusPay (tuyau) reste hors de ce module.
 */

export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise"

/** Commission GWA (fraction) par palier vendeur. */
export const SELLER_COMMISSION_RATES: Record<SubscriptionTier, number> = {
  free: 0.08,
  starter: 0.065,
  pro: 0.05,
  enterprise: 0.05,
}

/** Prix abo mensuel (FCFA). enterprise = null → devis. */
export const SUBSCRIPTION_PRICES_FCFA: Record<
  SubscriptionTier,
  number | null
> = {
  free: 0,
  starter: 7_500,
  pro: 18_000,
  enterprise: null,
}

/** FREE : max annonces actives. */
export const FREE_MAX_ACTIVE_LISTINGS = 5

export const TIER_LABELS_FR: Record<SubscriptionTier, string> = {
  free: "Gratuit",
  starter: "Starter",
  pro: "Pro",
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
  if (
    t === "enterprise" ||
    t === "entreprise" ||
    t === "corp" ||
    t === "business" ||
    t === "biz" ||
    t === "team"
  ) {
    return "enterprise"
  }
  return "free"
}

export function sellerCommissionRateForTier(
  tier: string | null | undefined,
): number {
  return SELLER_COMMISSION_RATES[normalizeSubscriptionTier(tier)]
}

export type SellerCommissionResult = {
  tier: SubscriptionTier
  rate: number
  pct: number
  pctLabel: string
  commissionFcfa: number
  vendeurRecoitFcfa: number
  /** Toujours 0 — pas de frais GWA acheteur. */
  buyerServiceFee: number
}

/**
 * Calcule la commission vendeur sur le sous-total catalogue (hors GeniusPay).
 * L’acheteur paie subtotal (+ shipping) ; GWA prélève sur le vendeur.
 */
export function computeSellerCommission(
  subtotal: number,
  sellerTier: string | null | undefined,
): SellerCommissionResult {
  const tier = normalizeSubscriptionTier(sellerTier)
  const rate = SELLER_COMMISSION_RATES[tier]
  const base = Math.max(0, Number(subtotal) || 0)
  const commissionFcfa = Math.round(base * rate)
  const pct = rate * 100
  const pctLabel = `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)} %`
  return {
    tier,
    rate,
    pct,
    pctLabel,
    commissionFcfa,
    vendeurRecoitFcfa: Math.max(0, base - commissionFcfa),
    buyerServiceFee: 0,
  }
}

/** @deprecated Utiliser computeSellerCommission — frais acheteur = 0. */
export function computeServiceFee(
  subtotal: number,
  _tier?: string | null,
): { fee: number; rate: number; tier: SubscriptionTier; pctLabel: string } {
  return {
    fee: 0,
    rate: 0,
    tier: normalizeSubscriptionTier(_tier),
    pctLabel: "0 %",
  }
}

/** @deprecated Alias historique — rates acheteur retirés. */
export const SERVICE_FEE_RATES = SELLER_COMMISSION_RATES
