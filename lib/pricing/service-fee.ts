/**
 * Affichage des paliers historiques (entitlements).
 * Le montant réellement prélevé sur une commande vient de `pricing_plans`
 * via le trigger `orders_apply_pricing`, pas de ces constantes.
 */
import { quotePricing, seedPlan } from "@/lib/pricing/quote"

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
