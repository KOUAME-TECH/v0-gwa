import { describe, expect, it } from "vitest"
import {
  buildOfferContent,
  parseOfferContent,
  formatOfferAmount,
} from "@/lib/chat/offer"
import {
  buildPurchaseOrderContent,
  parsePurchaseOrderContent,
  purchaseOrderPrintHtml,
} from "@/lib/chat/purchase-order"
import { hasIsoFinderPatterns, qrMatrix } from "@/lib/chat/qr-svg"

describe("parcours offre → bon de commande", () => {
  it("offre structurée qty/lieu/délai", () => {
    const raw = buildOfferContent({
      amount: 12500,
      quantity: 3,
      productName: "Cacao",
      location: "Abidjan",
      deliveryBy: "sous 7 jours",
    })
    const offer = parseOfferContent(raw)
    expect(offer?.amount).toBe(12500)
    expect(offer?.quantity).toBe(3)
    expect(offer?.location).toBe("Abidjan")
    expect(formatOfferAmount(offer!.amount)).toMatch(/12/)
  })

  it("PO + QR ISO scannable dans le HTML print", () => {
    const poRaw = buildPurchaseOrderContent({
      orderId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      orderNumber: "GWA-99",
      amount: 12500,
      quantity: 3,
      productName: "Cacao",
      location: "Abidjan",
      deliveryBy: "sous 7 jours",
      offerMessageId: "msg-offer-1",
    })
    const po = parsePurchaseOrderContent(poRaw)!
    const html = purchaseOrderPrintHtml(po, {
      buyerName: "Awa",
      sellerName: "Kouassi",
      origin: "https://mygwa.org",
    })
    expect(html).toMatch(/Abidjan/)
    expect(html).toMatch(/sous 7 jours/)
    expect(html).toMatch(/QR code ISO/)
    expect(html).toMatch(/data:image\/svg\+xml/)
    const matrix = qrMatrix("https://mygwa.org/dashboard/commandes")
    expect(hasIsoFinderPatterns(matrix)).toBe(true)
  })
})
