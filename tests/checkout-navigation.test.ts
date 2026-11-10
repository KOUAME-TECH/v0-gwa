import { describe, expect, it } from "vitest"
import { toGeniusPayAmountXof } from "@/lib/payment/amount"
import {
  interpretPayResponse,
  isGeniusPayCheckoutUrl,
  readPaymentRedirectUrl,
} from "@/lib/payment/checkout-navigation"

describe("montant GeniusPay", () => {
  it("envoie 30 000 francs XOF, pas des centimes", () => {
    expect(toGeniusPayAmountXof(30_000)).toBe(30_000)
    expect(toGeniusPayAmountXof(30_000.4)).toBe(30_000)
    expect(toGeniusPayAmountXof(30_000) * 100).not.toBe(toGeniusPayAmountXof(30_000))
  })
})

describe("redirection checkout", () => {
  it("accepte payment_url et checkout_url GeniusPay", () => {
    const payment = "https://geniuspay.ci/checkout/MTX-1"
    const pay = "https://pay.genius.ci/checkout/MTX-2"
    expect(isGeniusPayCheckoutUrl(payment)).toBe(true)
    expect(readPaymentRedirectUrl({ checkout_url: payment })).toBe(payment)
    expect(readPaymentRedirectUrl({ data: { payment_url: pay } })).toBe(pay)
    expect(isGeniusPayCheckoutUrl("https://evil.example/checkout")).toBe(false)
    expect(isGeniusPayCheckoutUrl("http://geniuspay.ci/checkout/x")).toBe(false)
  })

  it("redirige quand le paiement renvoie une URL", () => {
    const url = "https://geniuspay.ci/checkout/MTX-OK"
    expect(interpretPayResponse(200, { status: "redirect_required", payment_url: url })).toEqual({
      action: "redirect",
      url,
    })
  })

  it("n'envoie pas vers la confirmation si l'URL manque", () => {
    expect(interpretPayResponse(502, { error: "Lien de paiement indisponible" })).toEqual({
      action: "error",
      message: "Lien de paiement indisponible",
    })
    expect(interpretPayResponse(200, { status: "redirect_required" }).action).toBe("error")
    expect(interpretPayResponse(500, { error: "GENIUSPAY_HTTP_500" }).action).toBe("error")
  })
})
