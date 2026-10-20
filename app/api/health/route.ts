import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  hasSmsProvider,
  isAfricasTalkingLiveUsername,
  resolveAfricasTalkingSenderId,
} from '@/lib/auth/sms'
import { hasPlatformSecret } from '@/lib/ops/platform-secrets'
import {
  getOneSignalAppId,
  getOneSignalRestApiKey,
} from '@/lib/notifications/onesignal-config'
import { isOtpStoreReady } from '@/lib/auth/otp-store'
import {
  resolveGeniusPayCredentials,
  resolveGeniusPayWebhookSecret,
  type GeniusPayEnvironment,
} from '@/lib/payment/geniuspay'

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
  const onesignalApp = !!getOneSignalAppId()
  const onesignalRest = !!getOneSignalRestApiKey()
  const atKey = hasAfricasTalkingProvider()
  const atLive = isAfricasTalkingLiveUsername()
  const atSender = hasAfricasTalkingSenderId() || !!(await resolveAfricasTalkingSenderId())
  const geniusPayCredentials = await resolveGeniusPayCredentials()
  const configuredGeniusPayMode = process.env.GENIUSPAY_MODE?.trim().toLowerCase()
  const geniusPayEnvironment: GeniusPayEnvironment | null =
    configuredGeniusPayMode === 'sandbox' || configuredGeniusPayMode === 'live'
      ? configuredGeniusPayMode
      : geniusPayCredentials?.apiKey.startsWith('pk_sandbox_')
        ? 'sandbox'
        : geniusPayCredentials?.apiKey.startsWith('pk_live_')
          ? 'live'
          : null
  const geniusPayWebhookSecret = geniusPayEnvironment
    ? Boolean(await resolveGeniusPayWebhookSecret(geniusPayEnvironment))
    : false
  const geniusPayConfigured = Boolean(geniusPayCredentials)
  let geminiReady =
    envSet('GEMINI_API_KEY') ||
    envSet('GOOGLE_GENERATIVE_AI_API_KEY') ||
    envSet('YELLY_API_KEY')
  if (!geminiReady) {
    try {
      const { hasPlatformSecret } = await import('@/lib/ops/platform-secrets')
      geminiReady = await hasPlatformSecret('GEMINI_API_KEY', [
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'YELLY_API_KEY',
      ])
    } catch {
      geminiReady = false
    }
  }
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
      OTP_STORAGE: isOtpStoreReady(),
      SMS_AT: atKey,
      SMS_AT_USERNAME_LIVE: atLive,
      SMS_AT_SENDER_ID: atSender,
      SMS_TWILIO:
        envSet('TWILIO_ACCOUNT_SID') &&
        envSet('TWILIO_AUTH_TOKEN') &&
        (envSet('TWILIO_PHONE_NUMBER') || envSet('TWILIO_MESSAGING_SERVICE_SID')),
      SMS_TERMII: envSet('TERMII_API_KEY'),
      ONESIGNAL_APP_ID: onesignalApp,
      ONESIGNAL_REST_API_KEY: onesignalRest,
      GEMINI_API_KEY: geminiReady,
      GENIUSPAY_API_KEY: geniusPayConfigured,
      GENIUSPAY_API_SECRET: geniusPayConfigured,
      GENIUSPAY_WEBHOOK_SECRET: geniusPayWebhookSecret,
    },
    geniuspay: {
      configured: geniusPayConfigured,
      api_contract_ready: true,
      payin_ready: geniusPayConfigured,
      payment_verification_ready: geniusPayConfigured,
      payout_ready: false,
      webhook_ready: geniusPayConfigured && geniusPayWebhookSecret,
    },
    sms_delivery_ready: atKey && atLive && atSender,
    resilience: {
      onesignal_app_id_fallback: true,
      cron_auth: ['bearer', 'x-vercel-cron', 'digest_internal_key'],
      digest_scheduler: 'supabase_pg_cron',
      digest_job: 'gwa-harmattan-digest-daily',
      weather_degraded_fallback: true,
      sw_cache: 'gwa-v21-offline',
      sw_worker: 'OneSignalSDKWorker.js',
    },
  }, { status: healthy ? 200 : 503 })
}
