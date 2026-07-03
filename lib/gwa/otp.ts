// GWA Platform — OTP SMS via Africa's Talking
// Production-only : throw si clés absentes

import { normalizeCIPhone } from './phone'

interface OTPSendResult {
  success: boolean
  message_id: string
  cost: string
}

function getATConfig() {
  const username = process.env.AFRICASTALKING_USERNAME
  const apiKey   = process.env.AFRICASTALKING_API_KEY

  if (!username || !apiKey) {
    throw new Error(
      'Africa\'s Talking non configuré. Variables manquantes : AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY. ' +
      'Ajoutez-les dans les variables d\'environnement Vercel.'
    )
  }

  return { username, apiKey }
}

/**
 * Envoie un OTP SMS via Africa's Talking
 * @throws Error si clés non configurées ou si erreur envoi
 */
export async function sendOTPSms(
  phone: string,
  code: string
): Promise<OTPSendResult> {
  const { username, apiKey } = getATConfig()
  const normalized = normalizeCIPhone(phone)

  const message = `GWA Code de vérification : ${code}. Valable 10 minutes. Ne partagez jamais ce code.`

  const params = new URLSearchParams({
    username,
    to:      normalized,
    message,
    from:    'GWA',
  })

  const response = await fetch(
    'https://api.africastalking.com/version1/messaging',
    {
      method: 'POST',
      headers: {
        'apiKey':       apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':       'application/json',
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Africa's Talking error ${response.status}: ${err}`)
  }

  const result = await response.json()
  const recipient = result?.SMSMessageData?.Recipients?.[0]

  if (!recipient || recipient.status !== 'Success') {
    throw new Error(
      `SMS non livré. Statut : ${recipient?.status || 'unknown'}. ` +
      `Vérifiez le solde Africa's Talking.`
    )
  }

  return {
    success:    true,
    message_id: recipient.messageId,
    cost:       recipient.cost,
  }
}

/**
 * Envoie un SMS de confirmation de paiement
 */
export async function sendPaymentConfirmationSms(
  phone: string,
  orderNumber: string,
  amount: number
): Promise<OTPSendResult> {
  const { username, apiKey } = getATConfig()
  const normalized = normalizeCIPhone(phone)

  const formatted = new Intl.NumberFormat('fr-FR').format(amount)
  const message = `GWA - Commande #${orderNumber}. Paiement ${formatted} FCFA sécurisé. Votre vendeur prépare votre lot.`

  const params = new URLSearchParams({
    username,
    to:      normalized,
    message,
    from:    'GWA',
  })

  const response = await fetch(
    'https://api.africastalking.com/version1/messaging',
    {
      method: 'POST',
      headers: {
        'apiKey':       apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':       'application/json',
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Africa's Talking SMS error: ${err}`)
  }

  const result = await response.json()
  const recipient = result?.SMSMessageData?.Recipients?.[0]

  return {
    success:    recipient?.status === 'Success',
    message_id: recipient?.messageId || '',
    cost:       recipient?.cost || '',
  }
}
