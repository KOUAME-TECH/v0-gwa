import { quotePricing, type PricingPlanInput } from "@/lib/pricing/quote"

export type SellerPlanRates = Pick<
  PricingPlanInput,
  | "commission_rate"
  | "franchise_threshold"
  | "franchise_cap"
  | "buyer_service_fee_fixed"
  | "buyer_service_fee_rate"
>

export type PlatformFeeSettings = {
  buyer_service_fee_fixed?: number | null
}

export type OrderTotals = {
  baseAmount: number
  commission: number
  buyerFee: number
  totalPaid: number
  sellerNet: number
  franchiseApplied: boolean
}

/**
 * Totaux d'une commande à partir du plan vendeur lu en base.
 * La franchise ne s'applique que si le seuil et le plafond sont tous deux
 * strictement positifs (COOP_ENTERPRISE : taux seul, plafond 0).
 * Les frais acheteur viennent du réglage plateforme s'il est fourni, sinon du plan.
 */
export function calculateOrderTotals(
  productPrice: number,
  quantity: number,
  sellerPlan: SellerPlanRates,
  platformSettings: PlatformFeeSettings = {},
): OrderTotals {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const unit = Number(productPrice) || 0
  const baseAmount = unit * qty
  const buyerFixed =
    platformSettings.buyer_service_fee_fixed == null
      ? sellerPlan.buyer_service_fee_fixed
      : platformSettings.buyer_service_fee_fixed
  const quote = quotePricing(
    {
      name: "runtime",
      target: "producer",
      monthly_fee: 0,
      commission_rate: sellerPlan.commission_rate,
      buyer_service_fee_fixed: buyerFixed,
      buyer_service_fee_rate: sellerPlan.buyer_service_fee_rate,
      franchise_threshold: sellerPlan.franchise_threshold,
      franchise_cap: sellerPlan.franchise_cap,
      switch_threshold: null,
    },
    baseAmount,
  )
  return {
    baseAmount: quote.product_price,
    commission: quote.seller_commission,
    buyerFee: quote.buyer_service_fee,
    totalPaid: quote.total_amount,
    sellerNet: quote.seller_net_amount,
    franchiseApplied: quote.franchise_applied,
  }
}
