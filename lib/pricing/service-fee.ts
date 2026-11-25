/**
 * Affichage des paliers (entitlements) et copie de secours des taux.
 * Sur une commande réelle, le frais acheteur et la commission viennent de
 * `gwa_quote_pricing` (COALESCE(platform_settings.buyer_service_fee_fixed,
 * plan, 0)), appelée par le checkout et le trigger `orders_apply_pricing`.
 */
import { quotePricing, seedPlan } from "@/lib/pricing/quote"
import { BUYER_SERVICE_FEE_FIXED_FCFA } from "@/lib/pricing/published-grid"

export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise"

/** Commission GWA (fraction) par palier vendeur. */
export const SELLER_COMMISSION_RATES: Record<SubscriptionTier, number> = {
  free: seedPlan("FREE").commission_rate,
  starter: seedPlan("STARTER").commission_rate,
  pro: seedPlan("PRO").commission_rate,
  enterprise: seedPlan("COOP_ENTERPRISE").commission_rate,
}

/** Prix abo mensuel (FCFA). enterprise = null → devis. */
export const SUBSCRIPTION_PRICES_FCFA: Record<
  SubscriptionTier,
  number | null
> = {
  free: seedPlan("FREE").monthly_fee,
  starter: seedPlan("STARTER").monthly_fee,
  pro: seedPlan("PRO").monthly_fee,
  enterprise: null,
}

/** FREE : max annonces actives. */
export const FREE_MAX_ACTIVE_LISTINGS = 5

export const TIER_LABELS_FR: Record<SubscriptionTier, string> = {
  free: "Graine",
  starter: "Pousse",
  pro: "Récolte",
  enterprise: "Fédération",
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
  /** Frais de service acheteur (FCFA). Copie de secours : 250 F. */
  buyerServiceFee: number
}

/**
 * Calcule la commission vendeur sur le sous-total catalogue (hors GeniusPay).
 * L’acheteur paie le sous-total + le frais de service (250 F dans cette copie
 * de secours). Le montant réellement prélevé est celui de `gwa_quote_pricing`.
 */
export function computeSellerCommission(
  subtotal: number,
  sellerTier: string | null | undefined,
): SellerCommissionResult {
  const tier = normalizeSubscriptionTier(sellerTier)
  const planName =
    tier === "starter"
      ? "STARTER"
      : tier === "pro"
        ? "PRO"
        : tier === "enterprise"
          ? "COOP_ENTERPRISE"
          : "FREE"
  const quote = quotePricing(seedPlan(planName), subtotal)
  const pct = quote.commission_rate_applied * 100
  const pctLabel = `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)} %`
  return {
    tier,
    rate: quote.commission_rate_applied,
    pct,
    pctLabel,
    commissionFcfa: quote.seller_commission,
    vendeurRecoitFcfa: quote.seller_net_amount,
    buyerServiceFee: quote.buyer_service_fee,
  }
}

/**
 * @deprecated Préférer le devis serveur (`GET /api/pricing/quote` /
 * `gwa_quote_pricing`). Conservé pour d’éventuels appelants d’affichage.
 * Le frais officiel est un fixe de 250 F par opération (pas un pourcentage).
 * `subtotal` n’entre pas dans le calcul.
 */
export function computeServiceFee(
  _subtotal: number,
  _tier?: string | null,
): { fee: number; rate: number; tier: SubscriptionTier; pctLabel: string } {
  return {
    fee: BUYER_SERVICE_FEE_FIXED_FCFA,
    rate: 0,
    tier: normalizeSubscriptionTier(_tier),
    pctLabel: `${BUYER_SERVICE_FEE_FIXED_FCFA} F`,
  }
}

/** @deprecated Alias historique — ancien barème de taux, désormais les commissions vendeur. */
export const SERVICE_FEE_RATES = SELLER_COMMISSION_RATES
