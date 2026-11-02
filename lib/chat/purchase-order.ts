/**
 * Bon de commande issu d’une offre acceptée (Mission 3).
 * Stocké en messages.content (JSON) avec message_type = "order_sheet".
 */

export type PurchaseOrderPayload = {
  v: 1
  kind: "purchase_order"
  orderId: string
  orderNumber?: string
  amount: number
  currency: "XOF"
  quantity: number
  productName?: string
  productId?: string
  offerMessageId?: string
  /** Lien paiement / suivi — routes existantes, sans toucher APIs GeniusPay */
  payPath: string
  pinned?: boolean
}

export function buildPurchaseOrderContent(input: {
  orderId: string
  orderNumber?: string
  amount: number
  quantity?: number
  productName?: string
  productId?: string
  offerMessageId?: string
  payPath?: string
  pinned?: boolean
}): string {
  const amount = Math.round(Number(input.amount))
  if (!input.orderId) throw new Error("commande manquante")
  if (!Number.isFinite(amount) || amount < 1) throw new Error("montant invalide")
  const payload: PurchaseOrderPayload = {
    v: 1,
    kind: "purchase_order",
    orderId: input.orderId,
    amount,
    currency: "XOF",
    quantity: Math.max(1, Math.round(Number(input.quantity) || 1)),
    payPath: input.payPath || `/dashboard/commandes`,
    pinned: input.pinned !== false,
  }
  if (input.orderNumber) payload.orderNumber = input.orderNumber
  if (input.productName) payload.productName = input.productName
  if (input.productId) payload.productId = input.productId
  if (input.offerMessageId) payload.offerMessageId = input.offerMessageId
  return JSON.stringify(payload)
}

export function parsePurchaseOrderContent(
  content: string,
): PurchaseOrderPayload | null {
  try {
    const raw = JSON.parse(content)
    if (
      raw &&
      raw.v === 1 &&
      raw.kind === "purchase_order" &&
      typeof raw.orderId === "string" &&
      typeof raw.amount === "number"
    ) {
      return raw as PurchaseOrderPayload
    }
  } catch {
    /* ignore */
  }
  return null
}

export function purchaseOrderPrintHtml(po: PurchaseOrderPayload, parties: {
  buyerName?: string
  sellerName?: string
}): string {
  const qty = po.quantity || 1
  const total = po.amount * qty
  const num = po.orderNumber || po.orderId.slice(0, 8).toUpperCase()
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Bon de commande ${num}</title>
<style>
body{font-family:Georgia,serif;color:#111;padding:24px;max-width:640px;margin:0 auto}
h1{font-size:22px;margin:0 0 8px;color:#1F5C2E}
.meta{color:#54656f;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #ddd;padding:10px;text-align:left}
th{background:#f5f6f6}
.total{font-size:18px;font-weight:bold;color:#1F5C2E}
@media print{button{display:none}}
</style></head><body>
<h1>Bon de commande GWA</h1>
<p class="meta">N° ${num} · Prix convenu entre les parties</p>
<p><strong>Acheteur :</strong> ${parties.buyerName || "—"}<br/>
<strong>Vendeur :</strong> ${parties.sellerName || "—"}</p>
<table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
<tbody><tr>
<td>${po.productName || "Produit convenu"}</td>
<td>${qty}</td>
<td>${po.amount.toLocaleString("fr-FR")} FCFA</td>
<td>${total.toLocaleString("fr-FR")} FCFA</td>
</tr></tbody></table>
<p class="total">Total : ${total.toLocaleString("fr-FR")} FCFA</p>
<p class="meta">Paiement sécurisé via GWA. Ce document confirme l’accord négocié dans le chat.</p>
<button onclick="window.print()">Imprimer</button>
</body></html>`
}
