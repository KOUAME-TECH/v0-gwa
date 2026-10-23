import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGeniusPayWebhookSecret } from "@/lib/payment/geniuspay";
import {
  isGeniusPayWebhookEnvelopeConsistent,
  isGeniusPayWebhookTimestampFresh,
  verifyGeniusPayWebhookSignature,
} from "@/lib/payment/geniuspay-webhook-validation";

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
  const event = request.headers.get("x-webhook-event") || "";
  if (!signature || !isGeniusPayWebhookTimestampFresh(timestamp))
    return NextResponse.json({ error: "Webhook invalide" }, { status: 401 });
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(raw) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  if (
    !verifyGeniusPayWebhookSignature({
      timestamp,
      payload,
      rawPayload: raw,
      signature: signature.replace(/^sha256=/i, "").trim(),
      secret,
    })
  )
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  const payloadEvent = String(payload.event || payload.type || "");
  const environment = String(payload.environment || "live");
  if (
    event &&
    !isGeniusPayWebhookEnvelopeConsistent(payload, event, environment)
  )
    return NextResponse.json(
      { error: "Événement webhook invalide" },
      { status: 400 },
    );
  const deliveryId = String(
    payload.id ||
      payload.event_id ||
      payload.webhook_id ||
      payload.data?.id ||
      payload.data?.event_id ||
      `${event || "unknown"}:${timestamp}:${raw.length}`,
  );
  if (!deliveryId)
    return NextResponse.json(
      { error: "Identifiant webhook manquant" },
      { status: 400 },
    );
  const reference = String(
    payload.reference ||
      payload.transaction_reference ||
      payload.reference_id ||
      payload.data?.reference ||
      payload.data?.transaction_reference ||
      payload.data?.reference_id ||
      payload.data?.payment?.reference ||
      payload.payment?.reference ||
      payload.transaction?.reference ||
      payload.metadata?.reference ||
      payload.data?.metadata?.reference ||
      "",
  );
  const status = String(
    payload.status || payload.data?.status || "",
  ).toLowerCase();
  const amount = Number(payload.amount ?? payload.data?.amount);
  if (!reference)
    return NextResponse.json({ error: "reference manquante" }, { status: 400 });
  const admin = createAdminClient();
  const { data: alreadyProcessed } = await admin
    .from("order_audit_log")
    .select("id")
    .eq("action", "geniuspay_webhook_paid")
    .eq("notes", `delivery_id=${deliveryId}`)
    .maybeSingle();
  if (alreadyProcessed)
    return NextResponse.json({ received: true, duplicate: true });
  const { data: order } = await admin
    .from("orders")
    .select("id,total_amount,payment_status,escrow_status")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (!order) return NextResponse.json({ received: true, matched: false });
  if (["completed", "success", "successful", "paid"].includes(status)) {
    if (Number.isFinite(amount) && amount !== Number(order.total_amount))
      return NextResponse.json({ error: "Montant invalide" }, { status: 422 });
    if (order.payment_status !== "paid") {
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          escrow_status: "held",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      await admin
        .from("escrow_transactions")
        .update({ status: "held", paid_at: new Date().toISOString() })
        .eq("order_id", order.id);
      await admin.from("order_audit_log").insert({
        order_id: order.id,
        performed_by: null,
        action: "geniuspay_webhook_paid",
        new_value: "held",
        notes: `reference=${reference};delivery_id=${deliveryId};event=${payloadEvent || "unknown"}`,
      });
    }
  }
  return NextResponse.json({ received: true, matched: true });
}
