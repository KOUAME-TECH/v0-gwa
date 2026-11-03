import { NextResponse } from "next/server"
import { formatPhoneE164, validateCIPhone } from "@/lib/auth/phone"
import {
  createGeniusPayCheckout,
  getGeniusPayMode,
  isGeniusPayConfigured,
} from "@/lib/payment/geniuspay"

const TEST_PHONE = "0788326019"
const TEST_AMOUNT = 200

function clean(value: string | null): string {
  return (value || "").replace(/^"|"$/g, "").trim()
}

/**
 * Sonde de paiement live. Réservée au secret cron.
 * Montant fixe 200 FCFA, numéro de test fixé.
 */
export async function POST(request: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.GENIUSPAY_PROBE_TOKEN]
    .map((value) => clean(value ?? null))
    .filter(Boolean)
  const auth = request.headers.get("authorization") || ""
  if (!secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const phone = String(body?.phone || "")
  if (!validateCIPhone(phone) || phone.replace(/\D/g, "").endsWith(TEST_PHONE) === false) {
    return NextResponse.json({ error: "Numéro de test refusé" }, { status: 400 })
  }
  const e164 = formatPhoneE164(phone, "ci")
  if (e164 !== `+225${TEST_PHONE}`) {
    return NextResponse.json({ error: "Numéro de test refusé" }, { status: 400 })
  }

  if (!(await isGeniusPayConfigured())) {
    return NextResponse.json(
      { error: "GeniusPay non configuré", code: "GENIUSPAY_NOT_CONFIGURED" },
      { status: 503 },
    )
  }

  const result = await createGeniusPayCheckout({
    amount: TEST_AMOUNT,
    orderId: `probe-${Date.now().toString(36)}`,
    userId: "ops-probe",
    description: "GWA test paiement 200 FCFA",
    customer: { phone: e164, country: "CI", name: "Test GWA" },
    successUrl: "https://mygwa.org/commandes/confirmation",
    errorUrl: "https://mygwa.org/panier",
    metadata: { purpose: "live_probe" },
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: "Paiement non initié", code: result.error, mode: getGeniusPayMode() },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    mode: getGeniusPayMode(),
    amount: TEST_AMOUNT,
    currency: "XOF",
    phone: e164,
    reference: result.data.reference,
    payment_url: result.data.checkoutUrl || null,
  })
}
