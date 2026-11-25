import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGeniusPayWebhookSecret } from "@/lib/payment/geniuspay";
import { payInLedgerLines, recordLedgerLines } from "@/lib/features/payments/ledger";

export async function POST(request: Request) {
  const secret = await resolveGeniusPayWebhookSecret();
  if (!secret)
    return NextResponse.json(
      { error: "Webhook non configuré" },
      { status: 503 },
    );
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature") || "";
  const timestamp = request.headers.get("x-webhook-timestamp") || "";
  if (
    !signature ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return NextResponse.json({ error: "Webhook invalide" }, { status: 401 });
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/i, "").trim());
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  const payload = JSON.parse(raw) as Record<string, any>;
  const reference = String(payload.reference || payload.data?.reference || "");
  const status = String(
    payload.status || payload.data?.status || "",
  ).toLowerCase();
  const amount = Number(payload.amount ?? payload.data?.amount);
  const currency = String(payload.currency ?? payload.data?.currency ?? "").trim().toUpperCase();
  if (!reference)
    return NextResponse.json({ error: "reference manquante" }, { status: 400 });
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,total_amount,payment_status,escrow_status,fulfillment_mode,currency")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (!order) return NextResponse.json({ received: true, matched: false });
  if (["completed", "success", "successful", "paid"].includes(status)) {
    // Succès : montant et devise obligatoires et concordants (plus de succès sans montant).
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: "Montant manquant" }, { status: 422 });
    if (!/^[A-Z]{3}$/.test(currency))
      return NextResponse.json({ error: "Devise manquante" }, { status: 422 });
    if (amount !== Number(order.total_amount) || currency !== String(order.currency || "XOF").toUpperCase())
      return NextResponse.json({ error: "Montant invalide" }, { status: 422 });
    // Idempotence : déjà payé → ACK sans double écriture.
    if (order.payment_status === "paid") {
      return NextResponse.json({
        received: true,
        matched: true,
        idempotent: true,
      });
    }
    // Update conditionnel anti-race (deux webhooks simultanés).
    const { data: paidRows, error: payErr } = await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: order.fulfillment_mode === "preorder" ? "paid_preorder" : "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("payment_status", "paid")
      .select("id");
    if (payErr) {
      console.error("[webhooks/geniuspay] order update", payErr.message.slice(0, 120));
      return NextResponse.json({ error: "Le paiement n’a pas pu être enregistré." }, { status: 500 });
    }
    if (!paidRows?.length) {
      return NextResponse.json({
        received: true,
        matched: true,
        idempotent: true,
      });
    }
    await admin
      .from("escrow_transactions")
      .update({ status: "held", paid_at: new Date().toISOString() })
      .eq("order_id", order.id);
    await admin
      .from("order_audit_log")
      .insert({
        order_id: order.id,
        performed_by: null,
        action: "geniuspay_webhook_paid",
        new_value: "held",
        notes: `reference=${reference}`,
      });
    const ledger = await recordLedgerLines(
      admin as never,
      payInLedgerLines({
        transactionId: order.id,
        totalPaid: Number(order.total_amount) || 0,
        currency: order.currency || "XOF",
      }),
    );
    if (!ledger.ok) console.error("[webhooks/geniuspay] ledger", ledger.error);
  }
  return NextResponse.json({ received: true, matched: true });
}
