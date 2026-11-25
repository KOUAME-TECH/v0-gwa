import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getGeniusPayPayment, checkRateLimit, calls, baseOrder, buyer, orderId, reference, supabase, usesMissingProviderColumn } =
  vi.hoisted(() => {
    type Filter = { op: "eq" | "in"; column: string; value: unknown }
    type QueryCall = {
      table: string
      select?: string
      update?: Record<string, unknown>
      insert?: unknown
      filters: Filter[]
    }

    const calls: QueryCall[] = []
    const buyer = { id: "buyer-1" }
    const orderId = "order-1"
    const reference = "gp-ref-123"
    const baseOrder = {
      id: orderId,
      buyer_id: buyer.id,
      total_amount: 2500,
      currency: "XOF",
      payment_status: "processing",
      payment_method: "geniuspay",
      payment_reference: reference,
    }

    function usesMissingProviderColumn(call: {
      select?: string
      update?: Record<string, unknown>
      filters: Filter[]
    }) {
      return (
        /\bprovider_reference\b/.test(call.select ?? "") ||
        Boolean(call.update && "provider_reference" in call.update) ||
        call.filters.some((filter) => filter.column === "provider_reference")
      )
    }

    function columnError() {
      return {
        data: null,
        error: {
          code: "42703",
          message: 'column "provider_reference" does not exist',
        },
      }
    }

    function createBuilder(table: string) {
      const call: QueryCall = { table, filters: [] }
      calls.push(call)

      const builder = {
        select(columns: string) {
          call.select = columns
          return builder
        },
        eq(column: string, value: unknown) {
          call.filters.push({ op: "eq", column, value })
          return builder
        },
        in(column: string, value: unknown) {
          call.filters.push({ op: "in", column, value })
          return builder
        },
        update(payload: Record<string, unknown>) {
          call.update = payload
          return builder
        },
        insert(payload: unknown) {
          call.insert = payload
          return Promise.resolve({ data: null, error: null })
        },
        maybeSingle: async () => execute(),
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return execute().then(resolve, reject)
        },
      }

      async function execute() {
        if (table === "orders" && usesMissingProviderColumn(call)) {
          return columnError()
        }
        if (table === "orders" && call.update) {
          return { data: { id: orderId }, error: null }
        }
        if (table === "orders") {
          return { data: { ...baseOrder }, error: null }
        }
        return { data: null, error: null }
      }

      return builder
    }

    const supabase = {
      auth: {
        getUser: async () => ({ data: { user: buyer } }),
      },
      from: (table: string) => createBuilder(table),
    }

    return {
      getGeniusPayPayment: vi.fn(),
      checkRateLimit: vi.fn(),
      calls,
      baseOrder,
      buyer,
      orderId,
      reference,
      supabase,
      usesMissingProviderColumn,
    }
  })

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => supabase,
}))
vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit,
}))
vi.mock("@/lib/payment/geniuspay", () => ({
  getGeniusPayPayment,
}))

import { POST } from "@/app/api/orders/[id]/verify-payment/route"

function request() {
  return new Request(`https://gwa.test/api/orders/${orderId}/verify-payment`, {
    method: "POST",
  }) as never
}

function context() {
  return { params: Promise.resolve({ id: orderId }) }
}

describe("POST /api/orders/[id]/verify-payment", () => {
  beforeEach(() => {
    calls.length = 0
    baseOrder.payment_status = "processing"
    checkRateLimit.mockResolvedValue({ success: true, remaining: 1, resetAt: 0 })
    getGeniusPayPayment.mockReset()
    getGeniusPayPayment.mockResolvedValue({
      ok: true,
      data: {
        reference,
        amount: 2500,
        currency: "XOF",
        status: "completed",
        metadata: { order_id: orderId, user_id: buyer.id },
      },
    })
  })

  it("lit et filtre payment_reference (colonne réelle en prod) pour un paiement complété, de façon idempotente", async () => {
    const res = await POST(request(), context())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "paid" })
    expect(body.code).toBeUndefined()

    const orderReads = calls.filter((call) => call.table === "orders" && call.select && !call.update)
    expect(orderReads.length).toBeGreaterThan(0)
    for (const call of orderReads) {
      expect(call.select).toMatch(/\bpayment_reference\b/)
      expect(call.select).not.toMatch(/\bprovider_reference\b/)
    }

    expect(getGeniusPayPayment).toHaveBeenCalledWith(reference)

    const paidUpdate = calls.find(
      (call) => call.table === "orders" && call.update?.payment_status === "paid",
    )
    expect(paidUpdate).toBeTruthy()
    expect(paidUpdate?.filters).toContainEqual({
      op: "eq",
      column: "payment_reference",
      value: reference,
    })
    expect(paidUpdate?.filters.some((filter) => filter.column === "provider_reference")).toBe(
      false,
    )

    expect(calls.some((call) => usesMissingProviderColumn(call))).toBe(false)
  })

  it("reste idempotent si la commande est déjà payée, sans rappeler GeniusPay", async () => {
    baseOrder.payment_status = "paid"

    const res = await POST(request(), context())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "paid" })
    expect(getGeniusPayPayment).not.toHaveBeenCalled()

    const orderRead = calls.find((call) => call.table === "orders" && call.select && !call.update)
    expect(orderRead?.select).toMatch(/\bpayment_reference\b/)
    expect(orderRead?.select).not.toMatch(/\bprovider_reference\b/)
  })
})
