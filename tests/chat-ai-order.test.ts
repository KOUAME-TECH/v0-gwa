import { describe, it, expect } from "vitest"
import {
  formatAiAdviceMessage,
  stripAiAdvicePrefix,
  buildAiAdviceUserPrompt,
  AI_ADVICE_PREFIX,
} from "@/lib/chat/ai-advice"
import {
  buildPurchaseOrderContent,
  parsePurchaseOrderContent,
  purchaseOrderPrintHtml,
} from "@/lib/chat/purchase-order"
import { isAiMessage } from "@/lib/chat/roles"

describe("conseil IA chat", () => {
  it("préfixe les réponses Conseil", () => {
    const msg = formatAiAdviceMessage("Négocie le prix au kg.")
    expect(msg.startsWith(AI_ADVICE_PREFIX)).toBe(true)
    expect(stripAiAdvicePrefix(msg)).toBe("Négocie le prix au kg.")
    expect(isAiMessage({ content: msg })).toBe(true)
  })

  it("construit un prompt neutre", () => {
    expect(buildAiAdviceUserPrompt("prix cacao")).toMatch(/neutre/)
    expect(buildAiAdviceUserPrompt("prix cacao")).toMatch(/cacao/)
  })
})

describe("bon de commande", () => {
  it("sérialise / parse un bon", () => {
    const raw = buildPurchaseOrderContent({
      orderId: "ord-1",
      orderNumber: "GWA-42",
      amount: 15000,
      quantity: 2,
      productName: "Cacao",
    })
    const po = parsePurchaseOrderContent(raw)
    expect(po?.kind).toBe("purchase_order")
    expect(po?.amount).toBe(15000)
    expect(po?.pinned).toBe(true)
    expect(po?.payPath).toBe("/dashboard/commandes")
  })

  it("génère un HTML imprimable", () => {
    const po = parsePurchaseOrderContent(
      buildPurchaseOrderContent({
        orderId: "ord-1",
        amount: 1000,
        productName: "Manioc",
      }),
    )!
    const html = purchaseOrderPrintHtml(po, {
      buyerName: "Awa",
      sellerName: "Kouassi",
    })
    expect(html).toMatch(/Bon de commande/)
    expect(html).toMatch(/Manioc/)
    expect(html).toMatch(/window\.print/)
  })

  it("échappe le HTML dangereux dans le bon imprimable", () => {
    const po = parsePurchaseOrderContent(
      buildPurchaseOrderContent({
        orderId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        amount: 500,
        productName: `<img src=x onerror="alert(1)">`,
      }),
    )!
    const html = purchaseOrderPrintHtml(po, {
      buyerName: `<script>alert(1)</script>`,
      sellerName: `Kouassi & Cie`,
      origin: "https://mygwa.org",
    })
    expect(html).not.toMatch(/<script>/i)
    expect(html).toMatch(/&lt;img src=x/)
    expect(html).toMatch(/&lt;script&gt;/)
    expect(html).toMatch(/&amp;/)
    expect(html).toMatch(/Code de vérification/)
    expect(html).toMatch(/data:image\/svg\+xml/)
  })
})
