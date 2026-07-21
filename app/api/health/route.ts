import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasSmsProvider } from '@/lib/auth/sms'

export const dynamic = 'force-dynamic'

function envSet(name: string): boolean {
  return !!(process.env[name] || '').replace(/^"|"$/g, '').trim()
}

export async function GET() {
  let dbStatus = 'unknown'
  try {
    const supabase = await createClient()
    await supabase.from('profiles').select('id').limit(1)
    dbStatus = 'connected'
  } catch {
    dbStatus = 'error'
  }
  const healthy = dbStatus === 'connected'
  const smsConfigured = hasSmsProvider()
  const otpPepper = envSet('OTP_PEPPER')
  const cronSecret = envSet('CRON_SECRET')
  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    app: 'GWA Platform',
    tagline: 'Marche - langue Anoh, Cote d\'Ivoire',
    version: '2.0.0',
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: dbStatus,
    // Booléens ops uniquement — jamais les valeurs des secrets
    secrets: {
      OTP_PEPPER: otpPepper,
      CRON_SECRET: cronSecret,
      SMS_PROVIDER: smsConfigured,
      SMS_AT: envSet('AT_API_KEY') || envSet('AFRICASTALKING_API_KEY'),
      SMS_TWILIO:
        envSet('TWILIO_ACCOUNT_SID') &&
        envSet('TWILIO_AUTH_TOKEN') &&
        (envSet('TWILIO_PHONE_NUMBER') || envSet('TWILIO_MESSAGING_SERVICE_SID')),
      SMS_TERMII: envSet('TERMII_API_KEY'),
    },
  }, { status: healthy ? 200 : 503 })
}
