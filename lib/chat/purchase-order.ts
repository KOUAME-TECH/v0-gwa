/**
 * Bon de commande issu d’une offre acceptée (Mission 3).
 * Stocké en messages.content (JSON) avec message_type = "order_sheet".
 */

import { qrSvgDataUri } from "@/lib/chat/qr-svg"

/** Escape HTML entities — obligatoire avant injection dans print HTML. */
export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

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
  location?: string
  deliveryBy?: string
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
  location?: string
  deliveryBy?: string
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
  if (input.location) payload.location = input.location
  if (input.deliveryBy) payload.deliveryBy = input.deliveryBy
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
  origin?: string
}): string {
  const qty = po.quantity || 1
  const total = po.amount * qty
  const num = escapeHtml(po.orderNumber || po.orderId.slice(0, 8).toUpperCase())
  const product = escapeHtml(po.productName || "Produit convenu")
  const buyer = escapeHtml(parties.buyerName || "—")
  const seller = escapeHtml(parties.sellerName || "—")
  const location = po.location ? escapeHtml(po.location) : ""
  const delivery = po.deliveryBy ? escapeHtml(po.deliveryBy) : ""
  const origin =
    parties.origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://mygwa.org")
  const payUrl = escapeHtml(
    `${origin.replace(/\/$/, "")}${po.payPath.startsWith("/") ? po.payPath : `/${po.payPath}`}`,
  )
  const verifyCode = escapeHtml(po.orderId.replace(/-/g, "").slice(0, 12).toUpperCase())
  const amountFmt = escapeHtml(po.amount.toLocaleString("fr-FR"))
  const totalFmt = escapeHtml(total.toLocaleString("fr-FR"))
  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#1F5C2E"/><g transform="translate(318 118) rotate(28)"><ellipse cx="0" cy="0" rx="42" ry="68" fill="#C27D10"/><path d="M0 -58 C-2 -20 -2 20 0 58" fill="none" stroke="#7A4A08" stroke-width="5" stroke-linecap="round"/></g><path fill="#FFFFFF" d="M256 148c-58 0-104 46-104 108s46 108 104 108c38 0 72-20 90-52l-46-28c-10 16-28 26-44 26-28 0-50-22-50-54s22-54 50-54c16 0 30 8 40 20h-40v44h96c4-18 6-36 6-54 0-62-46-114-102-114z"/></svg>`
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Bon de commande ${num}</title>
<style>
body{font-family:Georgia,serif;color:#111;padding:24px;max-width:640px;margin:0 auto;position:relative}
body::before{content:"";position:fixed;inset:12% 18%;background:url("data:image/svg+xml,${encodeURIComponent(markSvg)}") center/180px no-repeat;opacity:0.06;pointer-events:none;z-index:0}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:12px;position:relative;z-index:1}
.brand svg{flex-shrink:0}
h1{font-size:22px;margin:0;color:#1F5C2E}
.meta{color:#54656f;font-size:13px;margin-bottom:20px;position:relative;z-index:1}
table{width:100%;border-collapse:collapse;margin:16px 0;position:relative;z-index:1}
th,td{border:1px solid #ddd;padding:10px;text-align:left}
th{background:#f5f6f6}
.total{font-size:18px;font-weight:bold;color:#1F5C2E;position:relative;z-index:1}
.verify{margin-top:24px;padding:16px;border:1px dashed #1F5C2E;border-radius:8px;text-align:center;position:relative;z-index:1}
.verify code{font-size:18px;letter-spacing:0.12em;font-weight:bold}
.accent{color:#C27D10}
@media print{button{display:none}}
</style></head><body>
<div class="brand">${markSvg}<div><h1>Bon de commande GWA</h1><p class="meta" style="margin:4px 0 0">Marché agricole · escrow</p></div></div>
<p class="meta">N° ${num} · Prix convenu entre les parties</p>
<p><strong>Acheteur :</strong> ${buyer}<br/>
<strong>Vendeur :</strong> ${seller}</p>
<table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead>
<tbody><tr>
<td>${product}</td>
<td>${qty}</td>
<td>${amountFmt} FCFA</td>
<td>${totalFmt} FCFA</td>
</tr></tbody></table>
${location || delivery ? `<p class="meta">${location ? `Lieu : ${location}` : ""}${location && delivery ? " · " : ""}${delivery ? `Délai : ${delivery}` : ""}</p>` : ""}
<p class="total">Total : ${totalFmt} FCFA</p>
<p class="meta">Paiement sécurisé via GWA. Ce document confirme l’accord négocié dans le chat.</p>
<div class="verify">
  <p class="meta" style="margin:0 0 8px">Code de vérification</p>
  <img src="${qrSvgDataUri(payUrl, 128)}" width="128" height="128" alt="QR code ISO de suivi et paiement GWA"/>
  <p><code>${verifyCode}</code></p>
  <p class="meta" style="margin:12px 0 0">Suivi / paiement : ${payUrl}</p>
</div>
<button onclick="window.print()">Imprimer</button>
</body></html>`
}
