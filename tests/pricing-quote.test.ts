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
  it("Graine 30 000 F : 9 % et marge sous 2 000 F après agrégateur", () => {
    const quote = quotePricing(seedPlan("FREE"), 30_000)
    expect(quote.seller_commission).toBe(2_700)
    expect(quote.buyer_service_fee).toBe(250)
    expect(quote.total_amount).toBe(30_250)
    expect(quote.seller_net_amount).toBe(27_300)
    expect(quote.franchise_applied).toBe(false)
    const margin = simulateMargin(seedPlan("FREE"), 30_000, aggregator)
    expect(margin.aggregator_fee).toBe(958)
    expect(margin.gwa_net_margin).toBe(1_992)
    expect(margin.margin_alert).toBe(true)
  })

  it("applique le plafond seulement au-dessus du seuil", () => {
    expect(quotePricing(seedPlan("FREE"), 133_000).seller_commission).toBe(11_970)
    expect(quotePricing(seedPlan("FREE"), 133_001).franchise_applied).toBe(true)
    expect(quotePricing(seedPlan("FREE"), 133_001).seller_commission).toBe(12_000)
    expect(quotePricing(seedPlan("STARTER"), 200_000).seller_commission).toBe(16_000)
    expect(quotePricing(seedPlan("STARTER"), 312_001).seller_commission).toBe(25_000)
    expect(quotePricing(seedPlan("PRO"), 500_000).seller_commission).toBe(35_000)
    expect(quotePricing(seedPlan("PRO"), 642_001).seller_commission).toBe(45_000)
  })

  it("coopératives : 7 %, 6 %, et 5 % sans franchise à 0", () => {
    expect(quotePricing(seedPlan("COOP_START"), 300_000).seller_commission).toBe(21_000)
    expect(quotePricing(seedPlan("COOP_START"), 500_001).seller_commission).toBe(35_000)
    expect(quotePricing(seedPlan("COOP_PRO"), 1_000_000).seller_commission).toBe(60_000)
    expect(quotePricing(seedPlan("COOP_PRO"), 1_000_001).seller_commission).toBe(60_000)
    expect(quotePricing(seedPlan("COOP_ENTERPRISE"), 2_000_000).franchise_applied).toBe(false)
    expect(quotePricing(seedPlan("COOP_ENTERPRISE"), 2_000_000).seller_commission).toBe(100_000)
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
    expect(quote.seller_commission).toBe(900)
    expect(quote.seller_net_amount).toBe(9_100)
  })

  it("mappe le palier legacy vers la bonne grille", () => {
    expect(legacyTierPlanName("producteur", "pro")).toBe("PRO")
    expect(legacyTierPlanName("cooperative", "free")).toBe("COOP_START")
    expect(legacyTierPlanName("cooperative", "enterprise")).toBe("COOP_ENTERPRISE")
    expect(subscriptionTierForPlan("COOP_PRO")).toBe("pro")
    expect(subscriptionTierForPlan("FREE")).toBe("free")
  })
})
