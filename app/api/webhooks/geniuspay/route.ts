import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGeniusPayPayment, resolveGeniusPayWebhookSecret } from "@/lib/payment/geniuspay";
import {
  isGeniusPayPaymentForOrder,
  isGeniusPaySuccessStatus,
} from "@/lib/payment/geniuspay-validation";
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
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(raw) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  const reference = String(payload.reference || payload.data?.reference || "");
  const status = String(
    payload.status || payload.data?.status || "",
  ).toLowerCase();
  const rawAmount = payload.amount ?? payload.data?.amount;
  const amount =
    rawAmount === null || rawAmount === undefined || rawAmount === ""
      ? Number.NaN
      : Number(rawAmount);
  const currency = String(payload.currency ?? payload.data?.currency ?? "")
    .trim()
    .toUpperCase();
  if (!reference)
    return NextResponse.json({ error: "reference manquante" }, { status: 400 });
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,buyer_id,total_amount,payment_status,escrow_status,fulfillment_mode,currency")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (!order) return NextResponse.json({ received: true, matched: false });
  if (["completed", "success", "successful", "paid"].includes(status)) {
    // Montant et devise obligatoires et cohérents avec la commande.
    if (!Number.isFinite(amount) || amount <= 0 || !currency)
      return NextResponse.json({ error: "Montant ou devise manquant" }, { status: 422 });
    if (
      amount !== Math.round(Number(order.total_amount)) ||
      currency !== String(order.currency || "XOF").toUpperCase()
    )
      return NextResponse.json({ error: "Montant ou devise incohérent" }, { status: 422 });
    let newlyPaid = false;
    if (order.payment_status !== "paid") {
      // Contre-vérification serveur à serveur auprès de GeniusPay avant de libérer quoi que ce soit.
      const verified = await getGeniusPayPayment(reference);
      if (!verified.ok || !verified.data) {
        return NextResponse.json({ error: "Vérification GeniusPay indisponible" }, { status: 502 });
      }
      const remote = verified.data as unknown as Parameters<typeof isGeniusPayPaymentForOrder>[0];
      if (
        !isGeniusPaySuccessStatus(String(remote.status || "")) ||
        !isGeniusPayPaymentForOrder(remote, {
          id: order.id,
          userId: order.buyer_id,
          totalAmount: Math.round(Number(order.total_amount)),
          reference,
        })
      ) {
        console.error("[webhooks/geniuspay] verification mismatch", { orderId: order.id });
        return NextResponse.json({ error: "Paiement non concordant" }, { status: 422 });
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
      newlyPaid = Boolean(paidRows?.length);
    }
    if (newlyPaid) {
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
    }
    // Rejeu : le grand livre est idempotent (clé transaction/comptes/montant), toujours tenté.
    const ledger = await recordLedgerLines(
      admin as never,
      payInLedgerLines({
        transactionId: order.id,
        totalPaid: Number(order.total_amount) || 0,
        currency: order.currency || "XOF",
      }),
    );
    if (!ledger.ok) {
      console.error("[webhooks/geniuspay] ledger", ledger.error);
      // 5xx : GeniusPay rejouera ; l'écriture conditionnelle ci-dessus rend le rejeu idempotent côté commande,
      // et gwa_record_ledger_entry est idempotent par (transaction, comptes, montant).
      return NextResponse.json({ error: "Écriture comptable en échec" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true, matched: true });
}
