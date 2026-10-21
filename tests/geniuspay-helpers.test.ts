import { describe, expect, it } from "vitest"
import {
  mapPaymentMethodToNetwork,
  normalizeGeniusPayPhone,
} from "@/lib/payment/networks"

describe("geniuspay helpers", () => {
  it("maps panier methods to CI networks", () => {
    expect(mapPaymentMethodToNetwork("orange")).toBe("orange_ci")
    expect(mapPaymentMethodToNetwork("mtn")).toBe("mtn_ci")
    expect(mapPaymentMethodToNetwork("wave")).toBe("wave_ci")
    expect(mapPaymentMethodToNetwork("moov")).toBe("moov_ci")
  })

  it("normalizes CI phones", () => {
    expect(normalizeGeniusPayPhone("0700000000")).toBe("225700000000")
    expect(normalizeGeniusPayPhone("2250700000000")).toMatch(/^225/)
    expect(normalizeGeniusPayPhone("")).toBeNull()
  })
})
