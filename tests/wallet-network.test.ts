import { describe, it, expect } from "vitest"
import { mapPaymentMethodToNetwork } from "@/lib/payment/networks"

describe("wallet withdraw network mapping (UI → API)", () => {
  it("mappe Orange / MTN / Moov depuis les clés UI", () => {
    expect(mapPaymentMethodToNetwork("orange_money")).toBe("orange_ci")
    expect(mapPaymentMethodToNetwork("mtn_money")).toBe("mtn_ci")
    expect(mapPaymentMethodToNetwork("moov_money")).toBe("moov_ci")
  })
})
