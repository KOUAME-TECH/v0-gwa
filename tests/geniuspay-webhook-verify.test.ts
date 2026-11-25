import { createHmac } from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getPayment,
  resolveGeniusPayWebhookSecret,
  getGeniusPayMode,
  recordLedgerLines,
  createAdminClient,
} = vi.hoisted(() => ({
  getPayment: vi.fn(),
  resolveGeniusPayWebhookSecret: vi.fn(),
  getGeniusPayMode: vi.fn(),
  recordLedgerLines: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/payment/geniuspay", () => ({
  getPayment,
  getGeniusPayPayment: getPayment,
  resolveGeniusPayWebhookSecret,
  getGeniusPayMode,
}))

vi.mock("@/lib/features/payments/ledger", () => ({
  payInLedgerLines: (input: unknown) => input,
  recordLedgerLines,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}))

import { handleGeniusPayWebhook } from "@/lib/payment/geniuspay-webhook-handler"

const SECRET = "whsec_test_local"
const ORDER_ID = "ord-1"
const REFERENCE = "GP-REF-100"

function sign(raw: string, ts: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")
}

function headersFor(raw: string, extra?: Record<string, string>) {
  const ts = String(Math.floor(Date.now() / 1000))
  return new Headers({
    "x-webhook-signature": sign(raw, ts),
    "x-webhook-timestamp": ts,
    ...extra,
  })
}

type OrderRow = {
  id: string
  total_amount: number
  payment_status: string
  escrow_status: string
  fulfillment_mode: string
  currency: string
}

function mockAdmin(opts: {
  order: OrderRow | null
  lookupError?: { message: string } | null
  updateRows?: { id: string }[]
  updateError?: { message: string } | null
}) {
  const orderUpdate = vi.fn()
  const escrowUpdate = vi.fn()
  const auditInsert = vi.fn()

  createAdminClient.mockReturnValue({
    from(table: string) {
      if (table === "orders") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: opts.lookupError ? null : opts.order,
                    error: opts.lookupError ?? null,
                  }),
                }
              },
            }
          },
          update(payload: unknown) {
            orderUpdate(payload)
            return {
              eq() {
                return {
                  neq() {
                    return {
                      select: async () => ({
                        data: opts.updateError ? null : (opts.updateRows ?? [{ id: ORDER_ID }]),
                        error: opts.updateError ?? null,
                      }),
                    }
                  },
                }
              },
            }
          },
        }
      }
      if (table === "escrow_transactions") {
        return {
          update(payload: unknown) {
            escrowUpdate(payload)
            return { eq: async () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === "order_audit_log") {
        return {
          insert: async (payload: unknown) => {
            auditInsert(payload)
            return { data: null, error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })

  return { orderUpdate, escrowUpdate, auditInsert }
}

const pendingOrder: OrderRow = {
  id: ORDER_ID,
  total_amount: 500,
  payment_status: "pending",
  escrow_status: "none",
  fulfillment_mode: "standard",
  currency: "XOF",
}

const completedPayment = {
  reference: REFERENCE,
  amount: 500,
  currency: "XOF",
  status: "completed",
  fees: 15,
  net_amount: 485,
  environment: "live",
  metadata: { order_id: ORDER_ID },
}

describe("handleGeniusPayWebhook — GET recoupe après HMAC", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveGeniusPayWebhookSecret.mockResolvedValue(SECRET)
    getGeniusPayMode.mockReturnValue("live")
    recordLedgerLines.mockResolvedValue({ ok: true })
  })

  it("rejette une signature HMAC invalide sans appeler GET", async () => {
    mockAdmin({ order: pendingOrder })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const ts = String(Math.floor(Date.now() / 1000))
    const headers = new Headers({
      "x-webhook-signature": "deadbeef",
      "x-webhook-timestamp": ts,
    })
    const result = await handleGeniusPayWebhook(raw, headers)
    expect(result.status).toBe(401)
    expect(result.body.error).toBe("Signature invalide")
    expect(getPayment).not.toHaveBeenCalled()
  })

  it("signe le corps brut (timestamp.raw) et pas JSON.stringify re-sérialisé", async () => {
    mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = '{ "reference": "GP-REF-100", "status": "completed", "amount": 500 }'
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(getPayment).toHaveBeenCalledWith(REFERENCE, "live")
  })

  it("renvoie 503 si le GET GeniusPay échoue, sans marquer payé", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({ ok: false, error: "GENIUSPAY_HTTP_500" })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(503)
    expect(result.body.code).toBe("GENIUSPAY_HTTP_500")
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("renvoie 503 si GeniusPay est injoignable", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockRejectedValue(new Error("fetch failed"))
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(503)
    expect(result.body.code).toBe("GENIUSPAY_REQUEST_FAILED")
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("renvoie 422 si le montant GET ne correspond pas", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, amount: 999 },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(422)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("renvoie 422 si la devise GET ne correspond pas", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, currency: "EUR" },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(422)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("renvoie 422 si la référence GET ne correspond pas", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, reference: "OTHER-REF" },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(422)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("renvoie 422 si metadata.order_id est présent et différent", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, metadata: { order_id: "autre-commande" } },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(422)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("accepte un paiement sans order_id quand montant, devise et référence concordent", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, metadata: {} },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(orderUpdate).toHaveBeenCalled()
  })

  it("n’accepte que le statut GET completed (pending → ACK sans paiement)", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, status: "pending" },
    })
    const raw = JSON.stringify({
      reference: REFERENCE,
      status: "completed",
      amount: 500,
    })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.pending).toBe(true)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("n’accepte plus success/paid sur le seul payload : le GET doit être completed", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, status: "success" },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "success", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.pending).toBe(true)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("marque payé selon le GET completed même si l’enveloppe dit pending", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = JSON.stringify({ reference: REFERENCE, status: "pending", amount: 1 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: "paid", escrow_status: "held", status: "confirmed" }),
    )
  })

  it("marque payé + ledger si le GET concordant est completed", async () => {
    const { orderUpdate, escrowUpdate, auditInsert } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(orderUpdate).toHaveBeenCalled()
    expect(escrowUpdate).toHaveBeenCalled()
    expect(auditInsert).toHaveBeenCalled()
    expect(recordLedgerLines).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ transactionId: ORDER_ID, totalPaid: 500, currency: "XOF" }),
    )
  })

  it("accepte le franc XOF arrondi à l’initiation (500,4 → 500)", async () => {
    const { orderUpdate } = mockAdmin({
      order: { ...pendingOrder, total_amount: 500.4 },
    })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(orderUpdate).toHaveBeenCalled()
  })

  it("est idempotent si la commande est déjà payée (pas de GET, pas de double écriture)", async () => {
    const { orderUpdate } = mockAdmin({
      order: { ...pendingOrder, payment_status: "paid" },
    })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.idempotent).toBe(true)
    expect(getPayment).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
    expect(recordLedgerLines).not.toHaveBeenCalled()
  })

  it("est idempotent si une course concurrente a déjà payé (update 0 ligne)", async () => {
    const { escrowUpdate } = mockAdmin({ order: pendingOrder, updateRows: [] })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.idempotent).toBe(true)
    expect(escrowUpdate).not.toHaveBeenCalled()
    expect(recordLedgerLines).not.toHaveBeenCalled()
  })

  it("refuse un enveloppe sandbox en mode live sans appeler GET", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    const raw = JSON.stringify({
      reference: REFERENCE,
      status: "completed",
      amount: 500,
      environment: "sandbox",
    })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(409)
    expect(getPayment).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("ignore un en-tête sandbox non signé si l’enveloppe et le GET sont live", async () => {
    mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({ ok: true, data: completedPayment })
    const raw = JSON.stringify({
      reference: REFERENCE,
      status: "completed",
      amount: 500,
      environment: "live",
    })
    const result = await handleGeniusPayWebhook(
      raw,
      headersFor(raw, { "x-webhook-environment": "sandbox" }),
    )
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(getPayment).toHaveBeenCalledWith(REFERENCE, "live")
  })

  it("refuse un paiement GET sandbox en mode live", async () => {
    const { orderUpdate } = mockAdmin({ order: pendingOrder })
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, environment: "sandbox" },
    })
    const raw = JSON.stringify({
      reference: REFERENCE,
      status: "completed",
      amount: 500,
      environment: "live",
    })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(409)
    expect(result.body.error).toBe("Paiement sandbox refusé en mode live")
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it("vérifie en sandbox quand le mode et l’enveloppe sont sandbox", async () => {
    mockAdmin({ order: pendingOrder })
    getGeniusPayMode.mockReturnValue("sandbox")
    getPayment.mockResolvedValue({
      ok: true,
      data: { ...completedPayment, environment: "sandbox" },
    })
    const raw = JSON.stringify({
      reference: REFERENCE,
      status: "completed",
      amount: 500,
      environment: "sandbox",
    })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(200)
    expect(result.body.verified).toBe(true)
    expect(getPayment).toHaveBeenCalledWith(REFERENCE, "sandbox")
  })

  it("renvoie 503 si la lecture de la commande échoue", async () => {
    mockAdmin({ order: null, lookupError: { message: "connection reset" } })
    const raw = JSON.stringify({ reference: REFERENCE, status: "completed", amount: 500 })
    const result = await handleGeniusPayWebhook(raw, headersFor(raw))
    expect(result.status).toBe(503)
    expect(getPayment).not.toHaveBeenCalled()
  })
})
