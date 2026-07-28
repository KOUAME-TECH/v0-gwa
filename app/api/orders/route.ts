import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"

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
    const sellerId = String(body?.seller_id || "")
    const items = (body?.items || []) as OrderItemInput[]

    if (!sellerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "seller_id et items requis" },
        { status: 400 },
      )
    }
    if (sellerId === user.id) {
      return NextResponse.json(
        { error: "Impossible de commander chez soi" },
        { status: 400 },
      )
    }

    // Résoudre prix depuis produits
    const productIds = items.map((i) => i.product_id)
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, price, seller_id, name, stock_quantity, status")
      .in("id", productIds)
      .eq("status", "active")

    if (pErr || !products?.length) {
      return NextResponse.json({ error: "Produits invalides" }, { status: 400 })
    }

    for (const p of products) {
      if (p.seller_id !== sellerId) {
        return NextResponse.json(
          { error: "Tous les produits doivent appartenir au même vendeur" },
          { status: 400 },
        )
      }
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
      // Prix toujours depuis la DB — ignorer unit_price client
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

    // Décision DG : 0 frais GWA acheteur ; commission vendeur selon palier vendeur
    const shipping = 0
    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", sellerId)
      .maybeSingle()
    const { computeSellerCommission } = await import("@/lib/pricing/service-fee")
    const commission = computeSellerCommission(
      subtotal,
      (sellerProfile as { subscription_tier?: string } | null)?.subscription_tier,
    )
    const serviceFee = 0
    const totalAmount = subtotal + shipping
    const commissionPct = commission.pct
    const commissionFcfa = commission.commissionFcfa
    const vendeurRecoit = commission.vendeurRecoitFcfa

    const orderNumber = `GWA-${Date.now().toString(36).toUpperCase()}`

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        order_number: orderNumber,
        subtotal,
        shipping_cost: shipping,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
        payment_status: "pending",
        escrow_status: "pending",
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
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error("[api/orders POST]", orderError?.message)
      return NextResponse.json(
        { error: orderError?.message || "Création commande échouée" },
        { status: 400 },
      )
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      lineItems.map((li) => ({ ...li, order_id: order.id })),
    )
    if (itemsError) {
      console.error("[api/orders items]", itemsError.message)
      return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    // Escrow tranche unique (100% à livraison) — pending jusqu'au pay
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

    // Notif + push vendeur
    await supabase.from("notifications").insert({
      user_id: sellerId,
      type: "order",
      title: "Nouvelle commande",
      message: `Commande ${orderNumber} reçue (${Math.round(totalAmount)} FCFA)`,
      body: `Commande ${orderNumber} reçue`,
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, sellerId, {
      title: "Nouvelle commande GWA",
      body: `${orderNumber} — ${Math.round(totalAmount)} FCFA`,
      url: "/dashboard/commandes",
      data: { order_id: order.id },
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error("[api/orders POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
