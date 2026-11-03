import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export type DbPricingQuote = {
  pricing_plan_id: string
  plan_name: string
  target: "producer" | "cooperative"
  product_price: number
  commission_rate_applied: number
  seller_commission: number
  franchise_applied: boolean
  buyer_service_fee: number
  seller_net_amount: number
  total_amount: number
}

export async function quoteSellerPricing(
  sellerId: string,
  productPrice: number,
): Promise<{ quote: DbPricingQuote } | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("gwa_quote_pricing", {
    p_seller_id: sellerId,
    p_product_price: productPrice,
  })
  if (error || !data) {
    return { error: error?.message || "pricing_unavailable" }
  }
  return { quote: data as DbPricingQuote }
}

export async function quotePlanPricing(
  planId: string,
  productPrice: number,
): Promise<{ quote: DbPricingQuote } | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("gwa_quote_pricing", {
    p_seller_id: null,
    p_product_price: productPrice,
    p_plan_id: planId,
  })
  if (error || !data) {
    return { error: error?.message || "pricing_unavailable" }
  }
  return { quote: data as DbPricingQuote }
}
