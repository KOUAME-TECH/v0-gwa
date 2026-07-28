import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseOfferContent } from "@/lib/chat/offer"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"

/**
 * POST /api/orders/from-offer
 * Crée une commande au prix négocié d'une offre chat acceptée.
 * Body: { message_id: string, quantity?: number }
 */
export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const messageId = String(body.message_id || "")
    const quantity = Math.max(1, Math.min(999_999, Number(body.quantity) || 1))
    if (!messageId) {
      return NextResponse.json({ error: "message_id requis" }, { status: 400 })
    }

    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, message_type")
      .eq("id", messageId)
      .maybeSingle()

    if (msgErr || !msg || msg.message_type !== "offer") {
      return NextResponse.json({ error: "Offre introuvable" }, { status: 404 })
    }

    const offer = parseOfferContent(msg.content)
    if (!offer || offer.status !== "accepted") {
      return NextResponse.json(
        { error: "L'offre doit être acceptée avant commande" },
        { status: 400 },
      )
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .eq("id", msg.conversation_id)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 })
    }

    const participants = [conv.participant_1, conv.participant_2]
    if (!participants.includes(user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Offreur = souvent acheteur ; l'autre = vendeur (ou inverse selon contexte produit)
    const offererId = msg.sender_id
    const otherId =
      conv.participant_1 === offererId ? conv.participant_2 : conv.participant_1

    let productId = offer.productId || null
    let sellerId = otherId
    let buyerId = offererId
    let catalogPrice: number | null = null
    let stockQty: number | null = null

    if (productId) {
      const { data: product } = await supabase
        .from("products")
        .select("id, seller_id, price, name, status, stock_quantity")
        .eq("id", productId)
        .maybeSingle()

      if (!product || product.status !== "active") {
        return NextResponse.json({ error: "Produit de l'offre indisponible" }, { status: 400 })
      }
      sellerId = product.seller_id
      // L'acheteur est l'autre participant que le vendeur
      buyerId = sellerId === offererId ? otherId : offererId
      catalogPrice = Math.round(Number(product.price))
      stockQty =
        product.stock_quantity == null ? null : Number(product.stock_quantity)
      if (user.id !== buyerId && user.id !== sellerId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
      }
    } else {
      // Sans produit : prendre le 1er produit actif du vendeur (autre participant)
      // Si l'offreur est vendeur, seller = offerer
      const { data: sellerProducts } = await supabase
        .from("products")
        .select("id, seller_id, name, status, price, stock_quantity")
        .eq("seller_id", otherId)
        .eq("status", "active")
        .limit(1)

      if (sellerProducts?.[0]) {
        productId = sellerProducts[0].id
        sellerId = otherId
        buyerId = offererId
        catalogPrice = Math.round(Number(sellerProducts[0].price))
        stockQty =
          sellerProducts[0].stock_quantity == null
            ? null
            : Number(sellerProducts[0].stock_quantity)
      } else {
        const { data: offererProducts } = await supabase
          .from("products")
          .select("id, seller_id, name, status, price, stock_quantity")
          .eq("seller_id", offererId)
          .eq("status", "active")
          .limit(1)
        if (offererProducts?.[0]) {
          productId = offererProducts[0].id
          sellerId = offererId
          buyerId = otherId
          catalogPrice = Math.round(Number(offererProducts[0].price))
          stockQty =
            offererProducts[0].stock_quantity == null
              ? null
              : Number(offererProducts[0].stock_quantity)
        }
      }
    }

    if (!productId) {
      return NextResponse.json(
        { error: "Aucun produit lié — précisez le produit dans l'offre" },
        { status: 400 },
      )
    }

    if (buyerId === sellerId) {
      return NextResponse.json({ error: "Acheteur/vendeur invalides" }, { status: 400 })
    }

    // Seul l'acheteur finalise la commande négociée
    if (user.id !== buyerId) {
      return NextResponse.json(
        { error: "Seul l'acheteur peut créer la commande" },
        { status: 403 },
      )
    }

    let unitPrice = Math.round(Number(offer.amount))
    if (!Number.isFinite(unitPrice) || unitPrice < 1) {
      return NextResponse.json({ error: "Montant négocié invalide" }, { status: 400 })
    }
    // Garde anti-inflation : le prix négocié ne peut pas dépasser le catalogue
    if (catalogPrice != null && Number.isFinite(catalogPrice) && catalogPrice > 0) {
      unitPrice = Math.min(unitPrice, catalogPrice)
    }
    if (stockQty != null && Number.isFinite(stockQty) && quantity > stockQty) {
      return NextResponse.json(
        { error: `Stock insuffisant (max ${stockQty})`, code: "OUT_OF_STOCK" },
        { status: 400 },
      )
    }

    const subtotal = unitPrice * quantity
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
    const orderNumber = `GWA-N-${Date.now().toString(36).toUpperCase()}`

    const admin = createAdminClient()
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        order_number: orderNumber,
        subtotal,
        shipping_cost: shipping,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
        payment_status: "pending",
        escrow_status: "pending",
        paiement_schema: "100_livraison",
        paiement_type: "mobile_money",
        payment_method: "mobile_money",
        notes: `Prix négocié chat (offre ${messageId})${offer.note ? `. ${offer.note}` : ""}`.trim(),
        commission_pct: commissionPct,
        commission_fcfa: commissionFcfa,
        vendeur_recoit_fcfa: vendeurRecoit,
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error("[orders/from-offer]", orderError?.message)
      return NextResponse.json(
        { error: orderError?.message || "Création commande échouée" },
        { status: 400 },
      )
    }

    const { error: itemsErr } = await admin.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total_price: subtotal,
    })

    if (itemsErr) {
      console.error("[orders/from-offer] items", itemsErr.message)
      return NextResponse.json({ error: itemsErr.message }, { status: 400 })
    }

    // Escrow aligné sur POST /api/orders
    await admin.from("escrow_transactions").insert({
      order_id: order.id,
      tranche_numero: 1,
      montant_fcfa: Math.round(totalAmount),
      pourcentage: 100,
      status: "pending",
      due_event: "livraison",
      due_days: 7,
    })

    await admin.from("order_audit_log").insert({
      order_id: order.id,
      performed_by: user.id,
      action: "order_created",
      new_value: "pending",
      notes: `Créée via négociation chat (offre ${messageId})`,
    })

    await admin.from("notifications").insert({
      user_id: sellerId,
      type: "order",
      title: "Commande au prix négocié",
      message: `Commande ${orderNumber} — ${unitPrice.toLocaleString("fr-FR")} FCFA × ${quantity}`,
      body: `Prix négocié accepté`,
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    // Notifier l'autre partie (push)
    const notifyUser = user.id === buyerId ? sellerId : buyerId
    void sendPushToUser(admin as never, notifyUser, {
      title: "Commande au prix négocié",
      body: `${unitPrice.toLocaleString("fr-FR")} FCFA × ${quantity}`,
      url: `/dashboard/commandes`,
      data: { type: "negotiated_order", order_id: order.id },
    })

    return NextResponse.json({
      success: true,
      order,
      negotiated_unit_price: unitPrice,
      redirect_to: `/dashboard/commandes`,
    })
  } catch (err) {
    console.error("[orders/from-offer]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
