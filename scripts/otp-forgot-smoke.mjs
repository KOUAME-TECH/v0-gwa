#!/usr/bin/env node
/**
 * Smoke OTP + forgot-password (noms de secrets only — jamais de valeurs).
 *
 * Usage:
 *   node scripts/otp-forgot-smoke.mjs https://mygwa.org
 *   node scripts/otp-forgot-smoke.mjs https://mygwa.org +2250700000001
 *
 * Critères:
 *   - /api/health public → status, version, db (200/503, sans secrets)
 *   - détails (secrets.OTP_* / SMS_*, sms_last_failure) seulement avec
 *     Authorization: Bearer $CRON_SECRET (variable d'environnement, jamais affichée)
 *   - POST /api/auth/send-otp avec Origin → pas de 403 CSRF ; 502 si SMS provider rejette
 *   - POST /api/auth/forgot-password → 200 anti-énumération ou 429 rate-limit
 *
 *   CRON_SECRET=... node scripts/otp-forgot-smoke.mjs https://mygwa.org
 *
 * Aucun SMS par défaut : la sonde CSRF « sans Origin » utilise un numéro
 * invalide (refusé avant tout envoi), et les appels send-otp « avec Origin »
 * (qui peuvent déclencher un vrai SMS) ne partent que si SMOKE_ALLOW_SMS=1
 * ET qu'un numéro est passé explicitement en 3e argument.
 */
const base = (process.argv[2] || "https://mygwa.org").replace(/\/$/, "")
const phone = process.argv[3] || ""
const allowSms = process.env.SMOKE_ALLOW_SMS === "1" && Boolean(phone)
// Numéro volontairement invalide : jamais routable vers un fournisseur SMS.
const PROBE_PHONE = "0000"

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
    return { status: res.status, body: text.slice(0, 200) }
  }
}

const origin = base
console.log("=== health ===")
const healthAuth = healthRequestInit()
const health = await json(await fetch(`${base}/api/health`, healthAuth.init))
console.log(JSON.stringify(health, null, 2))

console.log("\n=== send-otp (sans Origin, numéro invalide : aucun SMS possible) ===")
const noOrigin = await json(
  await fetch(`${base}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PROBE_PHONE, countryCode: "ci", intent: "login" }),
  }),
)
console.log(JSON.stringify(noOrigin, null, 2))
console.log(`csrf_send_otp=${noOrigin.status === 403 ? "OK (403)" : `ATTENTION HTTP ${noOrigin.status}`}`)

let withOrigin = { status: null, body: "ignoré (SMOKE_ALLOW_SMS!=1 ou numéro absent)" }
let retry = withOrigin
if (allowSms) {

console.log("\n=== send-otp (avec Origin) — peut envoyer un vrai SMS ===")
withOrigin = await json(
  await fetch(`${base}/api/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/auth/login`,
    },
    body: JSON.stringify({ phone, countryCode: "ci", intent: "login" }),
  }),
)
console.log(JSON.stringify(withOrigin, null, 2))

console.log("\n=== send-otp (retry immédiat — cooldown doit être libéré si SMS échoué) ===")
retry = await json(
  await fetch(`${base}/api/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/auth/login`,
    },
    body: JSON.stringify({ phone, countryCode: "ci", intent: "login" }),
  }),
)
console.log(JSON.stringify(retry, null, 2))
const cooldownFixed =
  withOrigin.status === 502 &&
  retry.status !== 429 &&
  (withOrigin.body?.retry_after === 0 || retry.status === 502)
console.log(`cooldown_rollback_ok=${cooldownFixed ? "YES" : "NO (deploy #20 manquant?)"}`)
} else {
  console.log("\n=== send-otp (avec Origin) : ignoré, aucun SMS envoyé ===")
  console.log("Pour l'activer : SMOKE_ALLOW_SMS=1 node scripts/otp-forgot-smoke.mjs <url> <numéro de test>")
}

console.log("\n=== forgot-password ===")
const forgot = await json(
  await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/auth/forgot-password`,
    },
    body: JSON.stringify({ email: "smoke-nonexistent@example.com" }),
  }),
)
console.log(JSON.stringify(forgot, null, 2))

const s = health.body?.secrets
console.log("\n=== checklist (noms only) ===")
console.log(
  `public status=${health.body?.status ?? "n/a"} version=${health.body?.version ?? "n/a"} db=${health.body?.db ?? "n/a"} http=${health.status}`,
)
if (!s || typeof s !== "object") {
  console.log(
    healthAuth.secretConfigured
      ? "détails ops absents : CRON_SECRET est défini mais n'a pas ouvert /api/health."
      : "réponse publique minimale. Définir CRON_SECRET pour lire secrets / sms_last_failure (Bearer).",
  )
} else {
  for (const k of [
    "OTP_PEPPER",
    "OTP_STORAGE",
    "SMS_PROVIDER",
    "SMS_AT",
    "SMS_AT_USERNAME_LIVE",
    "SMS_AT_SENDER_ID",
    "GENIUSPAY_API_KEY",
    "GENIUSPAY_API_SECRET",
    "GENIUSPAY_WEBHOOK_SECRET",
  ]) {
    console.log(`${k}=${s[k] === true ? "SET" : s[k] === false ? "MISSING" : "n/a"}`)
  }
  // #61 : Sender ID optionnel ; "default" = sender par défaut Africa's Talking
  console.log(`SMS_AT_SENDER_MODE=${s.SMS_AT_SENDER_MODE ?? "n/a"}`)
  console.log(`sms_delivery_ready=${health.body?.sms_delivery_ready ?? "n/a"}`)
  console.log(`sms_last_failure=${JSON.stringify(health.body?.sms_last_failure ?? null)}`)
  console.log(`deploy=${JSON.stringify(health.body?.deploy ?? null)}`)
}
console.log(`forgot_password=${forgot.status === 200 ? "OK" : `HTTP ${forgot.status}`}`)
