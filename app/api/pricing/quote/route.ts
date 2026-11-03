import { type NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { quoteSellerPricing } from "@/lib/pricing/server-quote"

/** GET /api/pricing/quote?seller_id=&amount= — décomposition affichée à l'acheteur. */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }
    const sellerId = request.nextUrl.searchParams.get("seller_id") || ""
    const amount = Number(request.nextUrl.searchParams.get("amount") || "")
    if (!sellerId || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "seller_id et amount requis" }, { status: 400 })
    }
    const priced = await quoteSellerPricing(sellerId, amount)
    if ("error" in priced) {
      return NextResponse.json(
        { error: "Grille tarifaire indisponible", code: "PRICING_UNAVAILABLE" },
        { status: 503 },
      )
    }
    const quote = priced.quote
    return NextResponse.json({
      product_price: quote.product_price,
      buyer_service_fee: quote.buyer_service_fee,
      total_amount: quote.total_amount,
      plan_name: quote.plan_name,
    })
  } catch (err) {
    console.error("[api/pricing/quote]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
