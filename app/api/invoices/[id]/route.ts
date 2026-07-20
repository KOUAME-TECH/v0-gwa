import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/invoices/[id]
 * Renvoie la facture (JSON) — accessible à l'acheteur ou au vendeur (RLS).
 * [id] = id de la facture OU id de la commande.
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .or(`id.eq.${id},order_id.eq.${id}`)
      .maybeSingle()

    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    }

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, order_number, subtotal, shipping_cost, service_fee, total_amount, status, payment_status, shipping_city, shipping_country, created_at, delivered_at, order_items(quantity, unit_price, total_price, product_id)",
      )
      .eq("id", invoice.order_id)
      .maybeSingle()

    const { data: parties } = await supabase
      .from("profiles")
      .select("id, full_name, city, country, phone")
      .in("id", [invoice.buyer_id, invoice.seller_id].filter(Boolean) as string[])

    const buyer = parties?.find((p) => p.id === invoice.buyer_id) ?? null
    const seller = parties?.find((p) => p.id === invoice.seller_id) ?? null

    return NextResponse.json({ invoice, order, buyer, seller })
  } catch (err) {
    console.error("[api/invoices GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
