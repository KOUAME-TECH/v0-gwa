import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/ops/platform-secrets", () => ({
  resolvePlatformSecret: vi.fn().mockResolvedValue(null),
}))

import {
  createGeniusPayCheckout,
  getGeniusPayPayment,
} from "@/lib/payment/geniuspay"

const checkoutResponse = {
  success: true,
  data: {
    reference: "gp-ref-123",
    amount: 2500,
    status: "pending",
    payment_url: "https://checkout.geniuspay.ci/session/abc",
    metadata: { order_id: "order-123", user_id: "buyer-123" },
  },
}

describe("GeniusPay API client", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends the documented server authentication headers and XOF order metadata", async () => {
    vi.stubEnv("GENIUSPAY_API_KEY", "test-api-key")
    vi.stubEnv("GENIUSPAY_API_SECRET", "test-api-secret")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(checkoutResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await createGeniusPayCheckout({
      amount: 2500,
      orderId: "order-123",
      userId: "buyer-123",
      description: "Commande test",
      successUrl: "https://gwa.example/commandes/confirmation?order=order-123",
      errorUrl: "https://gwa.example/commandes/confirmation?order=order-123&payment=failed",
    })

    expect(result.ok).toBe(true)
    expect(result.data?.reference).toBe("gp-ref-123")
    expect(result.data?.checkoutUrl).toBe("https://checkout.geniuspay.ci/session/abc")
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://geniuspay.ci/api/v1/merchant/payments")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      "X-API-Key": "test-api-key",
      "X-API-Secret": "test-api-secret",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: 2500,
      currency: "XOF",
      metadata: { order_id: "order-123", user_id: "buyer-123" },
    })
  })

  it("uses the documented reference lookup and refuses status responses without currency", async () => {
    vi.stubEnv("GENIUSPAY_API_KEY", "test-api-key")
    vi.stubEnv("GENIUSPAY_API_SECRET", "test-api-secret")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            reference: "gp-ref/123",
            amount: 2500,
            status: "completed",
            metadata: { order_id: "order-123" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getGeniusPayPayment("gp-ref/123")

    expect(result.ok).toBe(false)
    expect(result.error).toBe("GENIUSPAY_INVALID_STATUS_RESPONSE")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://geniuspay.ci/api/v1/merchant/payments/gp-ref%2F123")
    expect(init.method).toBe("GET")
    expect(init.headers).toMatchObject({
      "X-API-Key": "test-api-key",
      "X-API-Secret": "test-api-secret",
      "Content-Type": "application/json",
    })
  })
})
