import { describe, expect, it } from "vitest"
import { mapPaymentMethodToNetwork } from "@/lib/payment/networks"

describe("Mobile Money network mapping", () => {
  it("maps panier methods to CI networks", () => {
    expect(mapPaymentMethodToNetwork("orange")).toBe("orange_ci")
    expect(mapPaymentMethodToNetwork("mtn")).toBe("mtn_ci")
    expect(mapPaymentMethodToNetwork("wave")).toBe("wave_ci")
    expect(mapPaymentMethodToNetwork("moov")).toBe("moov_ci")
    expect(mapPaymentMethodToNetwork("geniuspay")).toBe("orange_ci")
  })
})
