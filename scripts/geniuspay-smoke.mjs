#!/usr/bin/env node
/**
 * Smoke GeniusPay (noms de secrets only — jamais de valeurs).
 *
 * Usage:
 *   node scripts/geniuspay-smoke.mjs https://mygwa.org
 *
 * Critères:
 *   - health.geniuspay.configured === true après secrets Vercel
 *   - webhook sans signature → 401/503 (jamais 500 silencieux)
 *   - pay sans auth → 401
 */
const base = (process.argv[2] || "https://mygwa.org").replace(/\/$/, "")

async function json(res) {
  const text = await res.text()
  try {
    return { status: res.status, body: JSON.parse(text) }
  } catch {
    return { status: res.status, body: text.slice(0, 180) }
  }
}

console.log("=== health (geniuspay flags) ===")
const health = await json(await fetch(`${base}/api/health`))
const secrets = health.body?.secrets || {}
const gp = health.body?.geniuspay || {}
console.log(
  JSON.stringify(
    {
      status: health.status,
      geniuspay: gp,
      GENIUSPAY_API_KEY: secrets.GENIUSPAY_API_KEY === true ? "SET" : "MISSING",
      GENIUSPAY_API_SECRET:
        secrets.GENIUSPAY_API_SECRET === true ? "SET" : "MISSING",
      GENIUSPAY_WEBHOOK_SECRET:
        secrets.GENIUSPAY_WEBHOOK_SECRET === true ? "SET" : "MISSING",
      deploy: health.body?.deploy || null,
    },
    null,
    2,
  ),
)

console.log("\n=== webhook geniuspay (sans signature) ===")
const wh = await json(
  await fetch(`${base}/api/webhooks/geniuspay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: "smoke-ref", status: "paid", amount: 1000 }),
  }),
)
console.log(JSON.stringify(wh, null, 2))

console.log("\n=== pay (sans session) ===")
const pay = await json(
  await fetch(`${base}/api/orders/00000000-0000-0000-0000-000000000000/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
    },
    body: JSON.stringify({}),
  }),
)
console.log(JSON.stringify(pay, null, 2))

console.log("\n=== checklist ===")
console.log(
  `configured=${gp.configured === true ? "YES" : "NO"} webhook_ready=${gp.webhook_ready === true ? "YES" : "NO"}`,
)
if (gp.configured !== true) {
  console.log(
    "ACTION HUMAINE: définir GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET / GENIUSPAY_WEBHOOK_SECRET sur Vercel Production",
  )
}
