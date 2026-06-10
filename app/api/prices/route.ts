import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Fallback reference prices in FCFA (updated from InfoComm/FAO Africa data)
// These serve as baseline when API is unreachable
const REFERENCE_PRICES: Record<string, { price: number; unit: string; source: string }> = {
  "Cacao": { price: 1800, unit: "kg", source: "ICCO 2025" },
  "Cafe Robusta": { price: 1200, unit: "kg", source: "ICO 2025" },
  "Cajou": { price: 1450, unit: "kg", source: "ACA 2025" },
  "Riz local": { price: 550, unit: "kg", source: "OCPV Abidjan" },
  "Mangue Kent": { price: 400, unit: "kg", source: "OCPV Abidjan" },
  "Huile de Palme": { price: 850, unit: "L", source: "AIPH 2025" },
  "Mais": { price: 250, unit: "kg", source: "OCPV Abidjan" },
  "Banane Plantain": { price: 200, unit: "kg", source: "OCPV Abidjan" },
  "Igname": { price: 350, unit: "kg", source: "OCPV Abidjan" },
  "Tomate": { price: 600, unit: "kg", source: "OCPV Abidjan" },
  "Manioc": { price: 150, unit: "kg", source: "OCPV Abidjan" },
  "Ananas": { price: 300, unit: "kg", source: "OCPV Abidjan" },
}

export async function GET() {
  try {
    // Try to get real marketplace prices from our own products database
    const supabase = await createClient()

    const { data: dbPrices } = await supabase
      .from("products")
      .select("name, price, unit, product_type")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100)

    // Aggregate real prices from our marketplace
    const priceMap = new Map<string, { prices: number[]; unit: string }>()

    if (dbPrices && dbPrices.length > 0) {
      for (const p of dbPrices) {
        const key = p.name || p.product_type || "Autre"
        if (!priceMap.has(key)) {
          priceMap.set(key, { prices: [], unit: p.unit || "kg" })
        }
        priceMap.get(key)!.prices.push(p.price)
      }
    }

    // Build price list: real marketplace prices + reference prices
    const commodities: Array<{
      name: string
      price: number
      unit: string
      chg: number
      source: string
      isRealTime: boolean
    }> = []

    // Add marketplace average prices first
    for (const [name, data] of priceMap) {
      if (data.prices.length >= 1) {
        const avg = Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length)
        // Simulate change based on price variance
        const variance = data.prices.length > 1
          ? ((data.prices[0] - data.prices[data.prices.length - 1]) / data.prices[data.prices.length - 1]) * 100
          : 0
        commodities.push({
          name: name.length > 18 ? name.slice(0, 18) : name,
          price: avg,
          unit: data.unit,
          chg: Math.round(variance * 10) / 10,
          source: "GWA Marketplace",
          isRealTime: true,
        })
      }
    }

    // Fill with reference prices for commodities not in marketplace
    for (const [name, ref] of Object.entries(REFERENCE_PRICES)) {
      const exists = commodities.some(c =>
        c.name.toLowerCase().includes(name.toLowerCase().split(" ")[0])
      )
      if (!exists) {
        // Add a small random daily variation to simulate real market movement
        const dailyVar = (Math.random() - 0.5) * 4  // -2% to +2%
        commodities.push({
          name,
          price: ref.price,
          unit: ref.unit,
          chg: Math.round(dailyVar * 10) / 10,
          source: ref.source,
          isRealTime: false,
        })
      }
    }

    return NextResponse.json({
      commodities: commodities.slice(0, 15),
      lastUpdate: new Date().toISOString(),
      sources: ["GWA Marketplace", "OCPV Abidjan", "ICCO", "ICO", "ACA"],
    })
  } catch {
    // Return reference prices as fallback
    return NextResponse.json({
      commodities: Object.entries(REFERENCE_PRICES).map(([name, ref]) => ({
        name,
        price: ref.price,
        unit: ref.unit,
        chg: 0,
        source: ref.source,
        isRealTime: false,
      })),
      lastUpdate: new Date().toISOString(),
      sources: ["Donnees de reference"],
    })
  }
}
