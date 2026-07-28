import { describe, expect, it } from "vitest"
import {
  mapPaymentMethodToNetwork,
  normalizeFeexPayPhone,
} from "@/lib/feexpay/networks"

describe("feexpay helpers", () => {
  it("maps panier methods to CI networks", () => {
    expect(mapPaymentMethodToNetwork("orange")).toBe("orange_ci")
    expect(mapPaymentMethodToNetwork("mtn")).toBe("mtn_ci")
    expect(mapPaymentMethodToNetwork("wave")).toBe("wave_ci")
    expect(mapPaymentMethodToNetwork("moov")).toBe("moov_ci")
  })

  it("normalizes CI phones", () => {
    expect(normalizeFeexPayPhone("0700000000")).toBe("225700000000")
    expect(normalizeFeexPayPhone("2250700000000")).toMatch(/^225/)
    expect(normalizeFeexPayPhone("")).toBeNull()
  })
})
