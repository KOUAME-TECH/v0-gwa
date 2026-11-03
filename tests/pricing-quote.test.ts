import { describe, expect, it } from "vitest"
import {
  legacyTierPlanName,
  quotePricing,
  seedPlan,
  simulateMargin,
  subscriptionTierForPlan,
} from "@/lib/pricing/quote"

const aggregator = { rate: 0.03, fixed: 50, alertBelow: 2_000 }

describe("grille tarifaire validée", () => {
  it("FREE 30 000 F : 8 % et marge sous 2 000 F après agrégateur", () => {
    const quote = quotePricing(seedPlan("FREE"), 30_000)
    expect(quote.seller_commission).toBe(2_400)
    expect(quote.buyer_service_fee).toBe(0)
    expect(quote.total_amount).toBe(30_000)
    expect(quote.seller_net_amount).toBe(27_600)
    expect(quote.franchise_applied).toBe(false)
    const margin = simulateMargin(seedPlan("FREE"), 30_000, aggregator)
    expect(margin.aggregator_fee).toBe(950)
    expect(margin.gwa_net_margin).toBe(1_450)
    expect(margin.margin_alert).toBe(true)
  })

  it("applique le plafond seulement au-dessus du seuil", () => {
    expect(quotePricing(seedPlan("FREE"), 100_000).seller_commission).toBe(8_000)
    expect(quotePricing(seedPlan("FREE"), 100_001).franchise_applied).toBe(true)
    expect(quotePricing(seedPlan("FREE"), 500_000).seller_commission).toBe(8_000)
    expect(quotePricing(seedPlan("STARTER"), 200_000).seller_commission).toBe(14_000)
    expect(quotePricing(seedPlan("STARTER"), 500_000).seller_commission).toBe(12_000)
    expect(quotePricing(seedPlan("PRO"), 500_000).seller_commission).toBe(30_000)
    expect(quotePricing(seedPlan("PRO"), 500_001).seller_commission).toBe(18_000)
  })

  it("coopératives : 6 %, 5 %, et 4 % sans franchise à 0", () => {
    expect(quotePricing(seedPlan("COOP_START"), 300_000).seller_commission).toBe(18_000)
    expect(quotePricing(seedPlan("COOP_START"), 1_000_000).seller_commission).toBe(12_000)
    expect(quotePricing(seedPlan("COOP_PRO"), 1_000_000).seller_commission).toBe(50_000)
    expect(quotePricing(seedPlan("COOP_PRO"), 1_000_001).seller_commission).toBe(32_000)
    const enterprise = quotePricing(seedPlan("COOP_ENTERPRISE"), 2_000_000)
    expect(enterprise.franchise_applied).toBe(false)
    expect(enterprise.seller_commission).toBe(80_000)
  })

  it("ajoute des frais acheteur configurés au total payé", () => {
    const plan = {
      ...seedPlan("FREE"),
      buyer_service_fee_fixed: 100,
      buyer_service_fee_rate: 0.01,
    }
    const quote = quotePricing(plan, 10_000)
    expect(quote.buyer_service_fee).toBe(200)
    expect(quote.total_amount).toBe(10_200)
    expect(quote.seller_commission).toBe(800)
    expect(quote.seller_net_amount).toBe(9_200)
  })

  it("mappe le palier legacy vers la bonne grille", () => {
    expect(legacyTierPlanName("producteur", "pro")).toBe("PRO")
    expect(legacyTierPlanName("cooperative", "free")).toBe("COOP_START")
    expect(legacyTierPlanName("cooperative", "enterprise")).toBe("COOP_ENTERPRISE")
    expect(subscriptionTierForPlan("COOP_PRO")).toBe("pro")
    expect(subscriptionTierForPlan("FREE")).toBe("free")
  })
})
