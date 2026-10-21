/**
 * GWA — F5 SMS fallback via Africa's Talking
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfricasTalking = require('africastalking')

function getATClient() {
  // AT_API_KEY / AT_USERNAME are the canonical production variables. Keep the
  // long-form names as backwards-compatible aliases for existing deployments.
  const username = process.env.AT_USERNAME || process.env.AFRICASTALKING_USERNAME
  const apiKey = process.env.AT_API_KEY || process.env.AFRICASTALKING_API_KEY
  if (!username || !apiKey) return null
  const at = AfricasTalking({ username, apiKey })
  return at.SMS
}

export async function sendDirectSMS(phone: string, message: string): Promise<void> {
  const sms = getATClient()
  if (!sms) {
    console.warn('[GWA] Africa\'s Talking not configured, skipping SMS')
    return
  }
  try {
    const from =
      process.env.AT_SENDER_ID ||
      process.env.SMS_AT_SENDER_ID ||
      process.env.AFRICASTALKING_FROM ||
      process.env.AFRICASTALKING_SENDER_ID
    await sms.send({
      to: [phone],
      message,
      ...(from ? { from } : {}),
    })
  } catch (err) {
    console.error('[GWA] AT SMS error:', err)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendSMSFallback(userId: string, supabase: any, message: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single()

    const phone = profile?.phone
    if (!phone) return

    await sendDirectSMS(phone, message.slice(0, 160))
  } catch (err) {
    console.error('[GWA] sendSMSFallback error:', err)
  }
}
