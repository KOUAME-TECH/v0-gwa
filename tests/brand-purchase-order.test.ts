import { describe, expect, it } from "vitest"
import {
  buildPurchaseOrderContent,
  escapeHtml,
  parsePurchaseOrderContent,
  purchaseOrderPrintHtml,
} from "@/lib/chat/purchase-order"

describe("bon de commande — identité visuelle", () => {
  it("escapeHtml neutralise XSS", () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).not.toMatch(/<|>/)
  })

  it("HTML d'impression inclut marque GWA (vert + or)", () => {
    const content = buildPurchaseOrderContent({
      orderId: "11111111-1111-1111-1111-111111111111",
      orderNumber: "PO-TEST",
      amount: 1500,
      quantity: 2,
      productName: `Piment <script>alert(1)</script>`,
    })
    const po = parsePurchaseOrderContent(content)!
    const html = purchaseOrderPrintHtml(po, {
      buyerName: "Achat'eur",
      sellerName: "YAO",
      origin: "https://mygwa.org",
    })
    expect(html).toContain("#1F5C2E")
    expect(html).toContain("#C27D10")
    expect(html).toContain("Bon de commande GWA")
    expect(html).not.toContain("<script>")
    expect(html).toMatch(/<svg[\s\S]*fill="#1F5C2E"/)
  })
})
