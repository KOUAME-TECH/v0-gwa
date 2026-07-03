// GWA Platform — Client Feexpay
// Intégration paiement Mobile Money CI : Orange Money, MTN, Moov, Wave
// Production-only : throw si clés absentes (pas de mock)

import crypto from 'crypto'

export type FeexpayOperator = 'orange_money_ci' | 'mtn_ci' | 'moov_ci' | 'wave_ci'

interface FeexpayInitPaymentInput {
  amount: number          // en FCFA, entier
  phone: string           // format E.164 : +225XXXXXXXXXX
  operator: FeexpayOperator
  order_id: string        // référence interne GWA
  description: string
  callback_url: string    // webhook URL Feexpay appellera
  return_url?: string     // redirect après paiement (web)
}

interface FeexpayPaymentResponse {
  success: boolean
  transaction_id: string
  feexpay_ref: string
  payment_url?: string  // URL redirect pour web
  ussd_code?: string    // code USSD pour mobile
  status: 'pending' | 'initiated'
}

interface FeexpayWebhookPayload {
  transaction_id: string
  order_id: string
  amount: number
  status: 'success' | 'failed' | 'cancelled'
  operator: string
  phone: string
  feexpay_ref: string
  timestamp: string
  signature: string
}

function getFeexpayConfig() {
  const apiKey    = process.env.FEEXPAY_API_KEY
  const apiSecret = process.env.FEEXPAY_API_SECRET
  const shopId    = process.env.FEEXPAY_SHOP_ID
  const baseUrl   = process.env.FEEXPAY_BASE_URL || 'https://api.feexpay.me'

  if (!apiKey || !apiSecret || !shopId) {
    throw new Error(
      'Feexpay non configuré. Variables manquantes : FEEXPAY_API_KEY, FEEXPAY_API_SECRET, FEEXPAY_SHOP_ID. ' +
      'Ajoutez-les dans les variables d\'environnement Vercel avant de passer en production.'
    )
  }

  return { apiKey, apiSecret, shopId, baseUrl }
}

/**
 * Initie un paiement escrow via Feexpay
 * @throws Error si clés Feexpay non configurées ou si erreur API
 */
export async function initiateFeexpayPayment(
  input: FeexpayInitPaymentInput
): Promise<FeexpayPaymentResponse> {
  const { apiKey, apiSecret, shopId, baseUrl } = getFeexpayConfig()

  const payload = {
    shop_id:      shopId,
    amount:       input.amount,
    phone:        input.phone,
    operator:     input.operator,
    order_id:     input.order_id,
    description:  input.description,
    callback_url: input.callback_url,
    return_url:   input.return_url,
    currency:     'XOF',
  }

  const signature = generateFeexpaySignature(payload, apiSecret)

  const response = await fetch(`${baseUrl}/v1/payment/initiate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      'X-Signature':   signature,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Feexpay API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json()

  return {
    success:        true,
    transaction_id: data.transaction_id,
    feexpay_ref:    data.feexpay_ref || data.transaction_id,
    payment_url:    data.payment_url,
    ussd_code:      data.ussd_code,
    status:         'initiated',
  }
}

/**
 * Vérifie la signature HMAC d'un webhook Feexpay
 * @throws Error si signature invalide (sécurité — rejeter la requête)
 */
export function verifyFeexpayWebhook(
  payload: FeexpayWebhookPayload,
  rawBody: string
): boolean {
  const { apiSecret } = getFeexpayConfig()

  const expectedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(rawBody)
    .digest('hex')

  // Comparaison en temps constant pour éviter les timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(payload.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

/**
 * Génère une signature HMAC pour une requête Feexpay
 */
function generateFeexpaySignature(
  payload: Record<string, unknown>,
  secret: string
): string {
  const sortedKeys = Object.keys(payload).sort()
  const signString = sortedKeys.map(k => `${k}=${payload[k]}`).join('&')
  return crypto.createHmac('sha256', secret).update(signString).digest('hex')
}

/**
 * Consulte le statut d'une transaction Feexpay
 */
export async function getFeexpayTransactionStatus(
  transactionId: string
): Promise<{ status: 'pending' | 'success' | 'failed' | 'cancelled'; amount: number }> {
  const { apiKey, baseUrl } = getFeexpayConfig()

  const response = await fetch(`${baseUrl}/v1/payment/status/${transactionId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!response.ok) {
    throw new Error(`Feexpay status check failed: ${response.status}`)
  }

  const data = await response.json()
  return { status: data.status, amount: data.amount }
}

export type { FeexpayInitPaymentInput, FeexpayPaymentResponse, FeexpayWebhookPayload }
