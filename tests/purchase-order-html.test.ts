import { describe, expect, it } from "vitest"
import { purchaseOrderPrintHtml } from "@/lib/chat/purchase-order"

describe("purchaseOrderPrintHtml", () => {
  it("échappe le HTML des noms", () => {
    const html = purchaseOrderPrintHtml(
      {
        v: 1,
        kind: "purchase_order",
        orderId: "abc",
        amount: 500,
        currency: "XOF",
        quantity: 1,
        productName: `<img src=x onerror=alert(1)>`,
        payPath: "/panier",
      },
      { buyerName: `A&B`, sellerName: `</p><script>` },
    )
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;img")
    expect(html).toContain("A&amp;B")
  })
})
