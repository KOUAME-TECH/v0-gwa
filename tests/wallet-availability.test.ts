import { afterEach, describe, expect, it } from "vitest"
import { isWalletRegulatoryApprovalEnabled } from "@/lib/wallet/availability"

const originalValue = process.env.GWA_WALLET_REGULATORY_APPROVAL

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.GWA_WALLET_REGULATORY_APPROVAL
  } else {
    process.env.GWA_WALLET_REGULATORY_APPROVAL = originalValue
  }
})

describe("wallet regulatory availability", () => {
  it("is disabled unless explicit approval is configured", () => {
    delete process.env.GWA_WALLET_REGULATORY_APPROVAL
    expect(isWalletRegulatoryApprovalEnabled()).toBe(false)
  })

  it("enables only for the exact approved value", () => {
    process.env.GWA_WALLET_REGULATORY_APPROVAL = "true"
    expect(isWalletRegulatoryApprovalEnabled()).toBe(true)
    process.env.GWA_WALLET_REGULATORY_APPROVAL = "1"
    expect(isWalletRegulatoryApprovalEnabled()).toBe(false)
  })
})
