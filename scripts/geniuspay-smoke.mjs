#!/usr/bin/env node
/**
 * Smoke GeniusPay (noms de secrets only — jamais de valeurs).
 *
 * Usage:
 *   node scripts/geniuspay-smoke.mjs https://mygwa.org
 *
 * Critères:
 *   - health public → status / version / db seulement
 *   - health.geniuspay.configured === true après secrets Vercel, visible avec
 *     Authorization: Bearer $CRON_SECRET (variable d'environnement, jamais affichée)
 *   - webhook sans signature → 401/503 (jamais 500 silencieux)
 *   - pay sans auth → 401
 *
 *   CRON_SECRET=... node scripts/geniuspay-smoke.mjs https://mygwa.org
 */
const base = (process.argv[2] || "https://mygwa.org").replace(/\/$/, "")

function healthRequestInit() {
  const secret = String(process.env.CRON_SECRET || "").replace(/^"|"$/g, "").trim()
  const headers = { Accept: "application/json" }
  if (secret) headers.Authorization = `Bearer ${secret}`
  return { secretConfigured: Boolean(secret), init: { headers } }
}

async function json(res) {
  const text = await res.text()
  try {
    return { status: res.status, body: JSON.parse(text) }
  } catch {
    return { status: res.status, body: text.slice(0, 180) }
  }
}

console.log("=== health (geniuspay flags) ===")
const healthAuth = healthRequestInit()
const health = await json(await fetch(`${base}/api/health`, healthAuth.init))
const secrets = health.body?.secrets
const gp = health.body?.geniuspay
const detailsVisible = secrets && typeof secrets === "object" && gp && typeof gp === "object"
console.log(
  JSON.stringify(
    detailsVisible
      ? {
          status: health.status,
          public: {
            status: health.body?.status ?? null,
            version: health.body?.version ?? null,
            db: health.body?.db ?? null,
          },
          geniuspay: gp,
          GENIUSPAY_API_KEY: secrets.GENIUSPAY_API_KEY === true ? "SET" : "MISSING",
          GENIUSPAY_API_SECRET:
            secrets.GENIUSPAY_API_SECRET === true ? "SET" : "MISSING",
          GENIUSPAY_WEBHOOK_SECRET:
            secrets.GENIUSPAY_WEBHOOK_SECRET === true ? "SET" : "MISSING",
          deploy: health.body?.deploy || null,
        }
      : {
          status: health.status,
          public: {
            status: health.body?.status ?? null,
            version: health.body?.version ?? null,
            db: health.body?.db ?? null,
          },
          details: healthAuth.secretConfigured
            ? "refusés (CRON_SECRET défini mais non accepté)"
            : "absents — réponse publique. Définir CRON_SECRET pour les drapeaux GeniusPay.",
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
if (!detailsVisible) {
  console.log(
    healthAuth.secretConfigured
      ? "configured=n/a (détails ops refusés)"
      : "configured=n/a (ping public). Relancer avec CRON_SECRET pour geniuspay.configured.",
  )
} else {
  console.log(
    `configured=${gp.configured === true ? "YES" : "NO"} webhook_ready=${gp.webhook_ready === true ? "YES" : "NO"}`,
  )
  if (gp.configured !== true) {
    console.log(
      "ACTION HUMAINE: définir GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET / GENIUSPAY_WEBHOOK_SECRET sur Vercel Production",
    )
  }
}
