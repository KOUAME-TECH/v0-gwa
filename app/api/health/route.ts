import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  hasSmsProvider,
  isAfricasTalkingLiveUsername,
  isSmsDeliveryReady,
} from '@/lib/auth/sms'
import { getFeexPayReadiness } from '@/lib/feexpay/client'
import {
  getOneSignalAppId,
  getOneSignalRestApiKey,
} from '@/lib/notifications/onesignal-config'

export const dynamic = 'force-dynamic'

function envSet(name: string): boolean {
  return !!(process.env[name] || '').replace(/^"|"$/g, '').trim()
}

async function isPrivilegedHealth(request: Request): Promise<boolean> {
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const auth = request.headers.get('authorization') || ''
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  try {
    const gate = await requireAdmin()
    return !!gate.isAdmin
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  let dbStatus = 'unknown'
  try {
    const supabase = await createClient()
    await supabase.from('profiles').select('id').limit(1)
    dbStatus = 'connected'
  } catch {
    dbStatus = 'error'
  }
  const healthy = dbStatus === 'connected'

  const privileged = await isPrivilegedHealth(request)
  if (!privileged) {
    return NextResponse.json(
      {
        status: healthy ? 'healthy' : 'degraded',
        app: 'GWA Platform',
        ping: 'pong',
        db: dbStatus,
        ts: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 },
    )
  }

  const smsConfigured = hasSmsProvider()
  const otpPepper = envSet('OTP_PEPPER')
  const cronSecret = envSet('CRON_SECRET')
  const onesignalApp = !!getOneSignalAppId()
  const onesignalRest = !!getOneSignalRestApiKey()
  const atKey = hasAfricasTalkingProvider()
  const atLive = isAfricasTalkingLiveUsername()
  const atSender = hasAfricasTalkingSenderId()
  const feex = getFeexPayReadiness()
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
      FEEXPAY_API_KEY: feex.configured,
      FEEXPAY_SHOP_ID: feex.configured,
      FEEXPAY_WEBHOOK_SECRET: feex.webhook_ready,
    },
    feexpay: {
      configured: feex.configured,
      mode: feex.mode,
      webhook_ready: feex.webhook_ready,
      payin_ready: feex.payin_ready,
      payout_ready: feex.payout_ready,
      live_blocked_reason: feex.live_blocked_reason,
    },
    sms_delivery_ready: isSmsDeliveryReady(),
    resilience: {
      onesignal_app_id_fallback: true,
      cron_auth: ['bearer', 'x-vercel-cron', 'digest_internal_key'],
      digest_scheduler: 'supabase_pg_cron',
      digest_scheduler_backup: 'vercel_cron',
      digest_job: 'gwa-harmattan-digest-daily',
      uptime_probe: '/api/health/ping',
      uptime_deep: '/api/health',
      weather_degraded_fallback: true,
      sw_cache: 'gwa-v21-offline',
      sw_worker: 'OneSignalSDKWorker.js',
    },
  }, { status: healthy ? 200 : 503 })
}
