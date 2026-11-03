import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildPurchaseOrderContent,
  parsePurchaseOrderContent,
} from "@/lib/chat/purchase-order"

const root = join(__dirname, "..")

describe("orders.currency — chat PO / GeniusPay alignment", () => {
  it("migration 058 adds ISO-4217 currency with XOF default", () => {
    const sql = readFileSync(join(root, "scripts/schema/058_order_currency.sql"), "utf8")
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF'/)
    expect(sql).toMatch(/orders_currency_format_check/)
    expect(sql).toContain("^[A-Z]{3}$")
  })

  it("POST /api/orders and from-offer insert currency XOF (schema-cache safe)", () => {
    const fromOffer = readFileSync(join(root, "app/api/orders/from-offer/route.ts"), "utf8")
    const orders = readFileSync(join(root, "app/api/orders/route.ts"), "utf8")
    expect(fromOffer).toMatch(/currency:\s*"XOF"/)
    expect(orders).toMatch(/currency:\s*"XOF"/)
  })

  it("verify-payment selects currency for GeniusPay XOF gate", () => {
    const verify = readFileSync(
      join(root, "app/api/orders/[id]/verify-payment/route.ts"),
      "utf8",
    )
    expect(verify).toMatch(/currency/)
    expect(verify).toMatch(/UNSUPPORTED_CURRENCY|order\.currency !== "XOF"/)
  })

  it("purchase-order payload currency is frozen to XOF", () => {
    const raw = buildPurchaseOrderContent({
      orderId: "11111111-2222-3333-4444-555555555555",
      amount: 2500,
      quantity: 2,
    })
    const po = parsePurchaseOrderContent(raw)
    expect(po?.currency).toBe("XOF")
  })
})
