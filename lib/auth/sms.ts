/**
 * Envoi SMS OTP — Africa's Talking (prioritaire), puis Twilio / Termii.
 *
 * Africa's Talking:
 *   AT_USERNAME (ou AFRICASTALKING_USERNAME) — "sandbox" en test
 *   AT_API_KEY  (ou AFRICASTALKING_API_KEY)
 *   AT_SENDER_ID (optionnel — shortcode / alphanumeric approuvé)
 *   AT_SANDBOX=true pour forcer l'API sandbox
 */

export type SmsResult = {
  success: boolean
  provider?: "africastalking" | "twilio" | "termii"
  sid?: string
  error?: string
  /** Code machine pour UX / ops */
  code?:
    | "AT_SANDBOX"
    | "AT_SENDER_ID_MISSING"
    | "AT_HTTP"
    | "AT_FAIL"
    | "SMS_PROVIDER_MISSING"
    | "TWILIO_FAIL"
    | "TERMII_FAIL"
  /** Ops hint (sandbox / sender manquant) — jamais de secret */
  warning?: string
}

/** Prêt à livrer OTP réels en prod (AT live + sender, ou Twilio/Termii). */
export function isSmsDeliveryReady(): boolean {
  if (hasTwilioProvider()) return true
  if (env("TERMII_API_KEY")) return true
  return (
    hasAfricasTalkingProvider() &&
    isAfricasTalkingLiveUsername() &&
    hasAfricasTalkingSenderId()
  )
}

function env(name: string): string {
  return (process.env[name] || "").replace(/^"|"$/g, "").trim()
}

export function hasTwilioProvider(): boolean {
  return (
    !!env("TWILIO_ACCOUNT_SID") &&
    !!env("TWILIO_AUTH_TOKEN") &&
    !!(env("TWILIO_PHONE_NUMBER") || env("TWILIO_MESSAGING_SERVICE_SID"))
  )
}

export function hasAfricasTalkingProvider(): boolean {
  return !!(env("AT_API_KEY") || env("AFRICASTALKING_API_KEY"))
}

/** Username AT live (pas sandbox) — requis pour livrer vers des mobiles réels. */
export function isAfricasTalkingLiveUsername(): boolean {
  const username =
    env("AT_USERNAME") || env("AFRICASTALKING_USERNAME") || "sandbox"
  return username.length > 0 && username.toLowerCase() !== "sandbox"
}

export function hasAfricasTalkingSenderId(): boolean {
  return !!(
    env("AT_SENDER_ID") ||
    env("SMS_AT_SENDER_ID") ||
    env("AFRICASTALKING_FROM") ||
    env("AFRICASTALKING_SENDER_ID")
  )
}

export function hasSmsProvider(): boolean {
  const termii = !!env("TERMII_API_KEY")
  return hasTwilioProvider() || hasAfricasTalkingProvider() || termii
}

export async function sendSmsOtp(
  phoneE164: string,
  code: string,
): Promise<SmsResult> {
  const body = `GWA: votre code est ${code}. Valable 10 min. Ne le partagez pas.`

  // Africa's Talking en priorité si clé présente (crédits GWA), puis Twilio, puis Termii.
  // (Avant : Twilio d'abord — or Twilio est souvent absent en CI.)
  if (hasAfricasTalkingProvider()) {
    const at = await sendViaAfricasTalking(phoneE164, body)
    if (at.success) return at
    // Ne pas masquer l'erreur AT derrière un autre provider silencieux
    if (at.error?.includes("sandbox") || at.error?.includes("AT_USERNAME")) {
      return at
    }
    const twilio = await sendViaTwilio(phoneE164, body)
    if (twilio.success) return twilio
    const termii = await sendViaTermii(phoneE164, body)
    if (termii.success) return termii
    return {
      success: false,
      provider: at.provider || twilio.provider || termii.provider,
      error:
        at.error ||
        twilio.error ||
        termii.error ||
        "Échec envoi SMS (AT / Twilio / Termii)",
    }
  }

  const twilio = await sendViaTwilio(phoneE164, body)
  if (twilio.success) return twilio

  const termii = await sendViaTermii(phoneE164, body)
  if (termii.success) return termii

  return {
    success: false,
    provider: twilio.provider || termii.provider,
    error:
      twilio.error ||
      termii.error ||
      "Aucun fournisseur SMS (AT_API_KEY / TWILIO_* / TERMII_API_KEY)",
  }
}

async function sendViaAfricasTalking(
  to: string,
  message: string,
): Promise<SmsResult> {
  const apiKey = env("AT_API_KEY") || env("AFRICASTALKING_API_KEY")
  const username =
    env("AT_USERNAME") || env("AFRICASTALKING_USERNAME") || "sandbox"
  const from =
    env("AT_SENDER_ID") ||
    env("SMS_AT_SENDER_ID") ||
    env("AFRICASTALKING_FROM") ||
    env("AFRICASTALKING_SENDER_ID")

  if (!apiKey) {
    return { success: false, error: "Africa's Talking non configuré" }
  }

  const useSandbox =
    env("AT_SANDBOX") === "true" ||
    env("AT_SANDBOX") === "1" ||
    username.toLowerCase() === "sandbox"

  // En prod Vercel, sandbox = crédits live inutilisables vers un mobile réel.
  if (
    useSandbox &&
    (process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production")
  ) {
    console.error(
      "[sms/africastalking] AT_USERNAME=sandbox (ou AT_SANDBOX) en production — SMS non livrés",
    )
    return {
      success: false,
      provider: "africastalking",
      code: "AT_SANDBOX",
      error:
        "AT_USERNAME encore en sandbox — définissez le username live Africa's Talking sur Vercel",
    }
  }

  // Live sans Sender ID approuvé CI → souvent file d'attente sans livraison.
  // Fail-closed en production pour ne pas stocker un OTP « fantôme ».
  if (
    !useSandbox &&
    !from &&
    (process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production")
  ) {
    console.error(
      "[sms/africastalking] AT_SENDER_ID manquant en production live",
    )
    return {
      success: false,
      provider: "africastalking",
      code: "AT_SENDER_ID_MISSING",
      error:
        "AT_SENDER_ID manquant — Sender ID alphanumérique approuvé requis pour la livraison SMS en CI",
    }
  }

  const endpoint = useSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging"

  const params = new URLSearchParams({
    username,
    to,
    message,
  })
  if (from) params.set("from", from)

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  const raw = await res.text()
  let data: {
    SMSMessageData?: {
      Message?: string
      Recipients?: Array<{
        statusCode?: number
        status?: string
        messageId?: string
        number?: string
      }>
    }
  } = {}
  try {
    data = JSON.parse(raw)
  } catch {
    console.error("[sms/africastalking] non-json", res.status, raw.slice(0, 300))
    return {
      success: false,
      provider: "africastalking",
      code: "AT_HTTP",
      error: `Africa's Talking HTTP ${res.status}`,
    }
  }

  const recipients = data.SMSMessageData?.Recipients || []
  const first = recipients[0]
  // statusCode 101 = Success (queued), 100 = Processed
  const ok =
    res.ok &&
    first &&
    (first.statusCode === 100 ||
      first.statusCode === 101 ||
      /success|sent|queued/i.test(first.status || ""))

  if (!ok) {
    console.error("[sms/africastalking]", res.status, data)
    return {
      success: false,
      provider: "africastalking",
      code: "AT_FAIL",
      error:
        first?.status ||
        data.SMSMessageData?.Message ||
        `Africa's Talking échec (${res.status})`,
    }
  }

  // Hors prod : warning si pas de sender (dev/sandbox).
  const warning = !from
    ? "AT_SENDER_ID manquant — en CI un Sender ID alphanumérique approuvé est souvent requis pour la livraison"
    : undefined
  if (warning) {
    console.warn("[sms/africastalking]", warning, {
      to: to.slice(0, 6) + "…",
      status: first.status,
      statusCode: first.statusCode,
    })
  } else {
    console.info("[sms/africastalking] queued", {
      status: first.status,
      statusCode: first.statusCode,
      sid: first.messageId,
    })
  }

  return {
    success: true,
    provider: "africastalking",
    sid: first.messageId,
    warning,
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID")
  const token = env("TWILIO_AUTH_TOKEN")
  const from = env("TWILIO_PHONE_NUMBER")
  const messagingService = env("TWILIO_MESSAGING_SERVICE_SID")

  if (!sid || !token || (!from && !messagingService)) {
    return { success: false, error: "Twilio non configuré" }
  }

  const params = new URLSearchParams({ To: to, Body: body })
  if (messagingService) params.set("MessagingServiceSid", messagingService)
  else if (from) params.set("From", from)

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  )

  const data = (await res.json().catch(() => ({}))) as {
    sid?: string
    message?: string
    error_message?: string
  }

  if (!res.ok) {
    console.error("[sms/twilio]", res.status, data)
    return {
      success: false,
      provider: "twilio",
      error: data.message || data.error_message || `Twilio HTTP ${res.status}`,
    }
  }

  return { success: true, provider: "twilio", sid: data.sid }
}

async function sendViaTermii(to: string, sms: string): Promise<SmsResult> {
  const apiKey = env("TERMII_API_KEY")
  if (!apiKey) return { success: false, error: "Termii non configuré" }

  const sender = env("TERMII_SENDER_ID") || "GWA"
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: to.replace("+", ""),
      from: sender,
      sms,
      type: "plain",
      channel: "generic",
      api_key: apiKey,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    message_id?: string
    message?: string
    code?: string
  }

  if (!res.ok || data.code === "error") {
    console.error("[sms/termii]", res.status, data)
    return {
      success: false,
      provider: "termii",
      error: data.message || `Termii HTTP ${res.status}`,
    }
  }

  return { success: true, provider: "termii", sid: data.message_id }
}
