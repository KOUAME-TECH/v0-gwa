import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"
import { isAgriculturalProductType } from "@/lib/catalog/scope"
import { quoteSellerPricing } from "@/lib/pricing/server-quote"
import {
  selfPurchaseMessage,
} from "@/lib/orders/purchase-guards"
import { releaseProduct, reserveProduct, type Reservation } from "@/lib/features/agritech/handle-stock"

type OrderItemInput = {
  product_id: string
  quantity: number
  unit_price?: number
}

/**
 * GET /api/orders — commandes de l'utilisateur (acheteur ou vendeur)
 * POST /api/orders — créer commande + escrow pending
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const role = request.nextUrl.searchParams.get("role") || "all"
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(50)

    if (role === "buyer") query = query.eq("buyer_id", user.id)
    else if (role === "seller") query = query.eq("seller_id", user.id)
    else query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ orders: data ?? [] })
  } catch (err) {
    console.error("[api/orders GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const items = (body?.items || []) as OrderItemInput[]

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Ajoutez au moins un produit avant de commander." },
        { status: 400 },
      )
    }

    // Résoudre prix depuis produits
    const productIds = items.map((i) => i.product_id)
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, price, seller_id, name, stock_quantity, preorder_quantity, harvest_date, status, product_type")
      .in("id", productIds)
      .eq("status", "active")

    if (pErr || !products?.length) {
      return NextResponse.json({ error: "Produits invalides" }, { status: 400 })
    }
    if (products.some((product) => !isAgriculturalProductType(product.product_type))) {
      return NextResponse.json(
        { error: "Seuls les produits agricoles peuvent être commandés", code: "OUT_OF_SCOPE" },
        { status: 400 },
      )
    }

    const catalogSellers = [...new Set(products.map((product) => product.seller_id))]
    if (catalogSellers.length !== 1 || !catalogSellers[0]) {
      return NextResponse.json(
        { error: "Une commande ne peut contenir que les produits d'un seul vendeur." },
        { status: 400 },
      )
    }
    const resolvedSellerId = String(catalogSellers[0])
    if (resolvedSellerId === user.id) {
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle()
      return NextResponse.json(
        {
          error: selfPurchaseMessage(buyerProfile?.user_type),
          code: "SELF_PURCHASE",
        },
        { status: 409 },
      )
    }

    const priceMap = new Map(products.map((p) => [p.id, p]))
    let subtotal = 0
    const lineItems: {
      product_id: string
      quantity: number
      unit_price: number
      total_price: number
    }[] = []

    for (const item of items) {
      const product = priceMap.get(item.product_id)
      if (!product) {
        return NextResponse.json(
          { error: `Produit ${item.product_id} introuvable` },
          { status: 400 },
        )
      }
      const qty = Math.max(1, Math.min(999_999, Number(item.quantity) || 1))
      const unitPrice = Number(product.price)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: `Prix invalide pour ${item.product_id}` },
          { status: 400 },
        )
      }
      const total = unitPrice * qty
      subtotal += total
      lineItems.push({
        product_id: item.product_id,
        quantity: qty,
        unit_price: unitPrice,
        total_price: total,
      })
    }

    const admin = createAdminClient()
    const reservations: Reservation[] = []
    for (const line of lineItems) {
      const reserved = await reserveProduct(admin as never, line.product_id, line.quantity)
      if (!reserved.ok) {
        for (const previous of reservations) await releaseProduct(admin as never, previous)
        return NextResponse.json(
          { error: reserved.error, code: "HARVEST_CAPACITY" },
          { status: 400 },
        )
      }
      reservations.push(reserved.reservation)
    }
    const fulfillmentMode = reservations.some((item) => item.mode === "preorder")
      ? "preorder"
      : "stock"
    const harvestDate =
      reservations
        .map((item) => item.harvestDate)
        .filter((value): value is string => Boolean(value))
        .sort()[0] || null

    const shipping = 0
    const priced = await quoteSellerPricing(resolvedSellerId, subtotal)
    if ("error" in priced) {
      for (const previous of reservations) await releaseProduct(admin as never, previous)
      return NextResponse.json(
        { error: "Grille tarifaire indisponible", code: "PRICING_UNAVAILABLE" },
        { status: 503 },
      )
    }
    const quote = priced.quote
    const serviceFee = quote.buyer_service_fee
    const totalAmount = quote.total_amount + shipping
    const commissionPct = Math.round(quote.commission_rate_applied * 10000) / 100
    const commissionFcfa = quote.seller_commission
    const vendeurRecoit = quote.seller_net_amount

    const orderNumber = `GWA-${Date.now().toString(36).toUpperCase()}`

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: resolvedSellerId,
        order_number: orderNumber,
        subtotal,
        shipping_cost: shipping,
        service_fee: serviceFee,
        total_amount: totalAmount,
        currency: "XOF",
        status: "pending",
        payment_status: "pending",
        escrow_status: "pending",
        fulfillment_mode: fulfillmentMode,
        paiement_schema: body?.paiement_schema || "100_livraison",
        paiement_type: body?.payment_method || "mobile_money",
        payment_method: body?.payment_method || "mobile_money",
        shipping_address: body?.shipping_address || null,
        shipping_city: body?.shipping_city || null,
        shipping_country: body?.shipping_country || "CI",
        shipping_phone: body?.shipping_phone || null,
        notes: body?.notes || null,
        commission_pct: commissionPct,
        commission_fcfa: commissionFcfa,
        vendeur_recoit_fcfa: vendeurRecoit,
        product_price: quote.product_price,
        buyer_service_fee: quote.buyer_service_fee,
        seller_commission: quote.seller_commission,
        seller_net_amount: quote.seller_net_amount,
        pricing_plan_id: quote.pricing_plan_id,
        commission_rate_applied: quote.commission_rate_applied,
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error("[api/orders POST]", orderError?.message)
      for (const previous of reservations) await releaseProduct(admin as never, previous)
      return NextResponse.json(
        { error: "La commande n’a pas pu être créée. Réessaie." },
        { status: 400 },
      )
    }

    const { error: itemsError } = await admin.from("order_items").insert(
      lineItems.map((li, index) => ({
        ...li,
        order_id: order.id,
        stock_taken: reservations[index]?.stockTaken || 0,
        preorder_taken: reservations[index]?.preorderTaken || 0,
      })),
    )
    if (itemsError) {
      console.error("[api/orders items]", itemsError.message)
      await admin.from("orders").delete().eq("id", order.id)
      for (const previous of reservations) await releaseProduct(admin as never, previous)
      return NextResponse.json(
        { error: "La commande n’a pas pu être créée. Réessaie." },
        { status: 400 },
      )
    }

    await supabase.from("escrow_transactions").insert({
      order_id: order.id,
      tranche_numero: 1,
      montant_fcfa: Math.round(totalAmount),
      pourcentage: 100,
      status: "pending",
      due_event: "livraison",
      due_days: 7,
    })

    await supabase.from("order_audit_log").insert({
      order_id: order.id,
      performed_by: user.id,
      action: "order_created",
      new_value: "pending",
      notes: "Créée via /api/orders",
    })

    await supabase.from("notifications").insert({
      user_id: resolvedSellerId,
      type: "order",
      title: "Nouvelle commande",
      message: `Commande ${orderNumber} reçue (${Math.round(totalAmount)} FCFA)`,
      body: `Commande ${orderNumber} reçue`,
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, resolvedSellerId, {
      title: "Nouvelle commande GWA",
      body: `${orderNumber} — ${Math.round(totalAmount)} FCFA`,
      url: "/dashboard/commandes",
      data: { order_id: order.id },
    })

    return NextResponse.json(
      { order, fulfillment_mode: fulfillmentMode, harvest_date: harvestDate },
      { status: 201 },
    )
  } catch (err) {
    console.error("[api/orders POST]", err)
    return NextResponse.json(
      { error: "La commande n’a pas pu être créée. Réessaie." },
      { status: 500 },
    )
  }
}
