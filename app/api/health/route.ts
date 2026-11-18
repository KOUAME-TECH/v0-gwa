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
import { getSmsOpsFailure, isOtpStoreReady } from '@/lib/auth/otp-store'
import { authorizeCronRequest } from '@/lib/security/cron-auth'
import { requireAdmin } from '@/lib/auth/require-admin'

export const dynamic = 'force-dynamic'

export const PUBLIC_HEALTH_KEYS = ['status', 'version', 'db'] as const

/** Même URL pour le ping public et le détail ops : ne pas laisser un cache partagé rejouer le détail. */
const HEALTH_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, Cookie',
}

function envSet(name: string): boolean {
  return !!(process.env[name] || '').replace(/^"|"$/g, '').trim()
}

export function publicHealthBody(dbStatus: string) {
  const healthy = dbStatus === 'connected'
  return {
    status: healthy ? 'healthy' : 'degraded',
    version: '2.0.0',
    db: dbStatus,
  }
}

/** Détails ops : Bearer CRON_SECRET uniquement (pas x-vercel-cron ni le mode dev). */
export function isHealthCronBearerAuthorized(request: Request): boolean {
  return authorizeCronRequest(request).via === 'bearer'
}

export async function isHealthOpsAuthorized(request: Request): Promise<boolean> {
  if (isHealthCronBearerAuthorized(request)) return true
  try {
    const gate = await requireAdmin()
    return Boolean(gate.user && gate.isAdmin)
  } catch {
    return false
  }
}

async function collectOpsDetails() {
  const smsConfigured = hasSmsProvider()
  const otpPepper = envSet('OTP_PEPPER')
  const cronSecret = envSet('CRON_SECRET')
  const onesignalApp = !!getOneSignalAppId()
  const onesignalRest = !!getOneSignalRestApiKey()
  const atKey = hasAfricasTalkingProvider()
  const atLive = isAfricasTalkingLiveUsername()
  const atSender = hasAfricasTalkingSenderId() || !!(await resolveAfricasTalkingSenderId())
  const geniuspayKey =
    envSet('GENIUSPAY_API_KEY') ||
    envSet('X_API_Key') ||
    envSet('X_API_KEY') ||
    (await hasPlatformSecret('GENIUSPAY_API_KEY', ['X_API_Key', 'X_API_KEY']))
  const geniuspaySecret =
    envSet('GENIUSPAY_API_SECRET') ||
    envSet('X_API_Secret') ||
    envSet('X_API_SECRET') ||
    (await hasPlatformSecret('GENIUSPAY_API_SECRET', ['X_API_Secret', 'X_API_SECRET']))
  const geniuspayWebhook =
    envSet('GENIUSPAY_WEBHOOK_SECRET') ||
    envSet('X_Webhook_Secret') ||
    envSet('X_WEBHOOK_SECRET') ||
    (await hasPlatformSecret('GENIUSPAY_WEBHOOK_SECRET', [
      'X_Webhook_Secret',
      'X_WEBHOOK_SECRET',
    ]))
  let geminiReady =
    envSet('GEMINI_API_KEY') ||
    envSet('GOOGLE_GENERATIVE_AI_API_KEY') ||
    envSet('YELLY_API_KEY')
  if (!geminiReady) {
    try {
      geminiReady = await hasPlatformSecret('GEMINI_API_KEY', [
        'GOOGLE_GENERATIVE_AI_API_KEY',
        'YELLY_API_KEY',
      ])
    } catch {
      geminiReady = false
    }
  }
  return {
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    app: 'GWA Platform',
    tagline: 'Marche - langue Anoh, Cote d\'Ivoire',
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
      GENIUSPAY_API_KEY: geniuspayKey,
      GENIUSPAY_API_SECRET: geniuspaySecret,
      GENIUSPAY_WEBHOOK_SECRET: geniuspayWebhook,
    },
    geniuspay: {
      configured: Boolean(geniuspayKey && geniuspaySecret),
      webhook_ready: Boolean(geniuspayWebhook),
      payin_ready: Boolean(geniuspayKey && geniuspaySecret),
      payout_ready: false,
    },
    sms_delivery_ready: atKey && atLive && atSender,
    sms_last_failure: await getSmsOpsFailure(),
    deploy: {
      git_sha:
        (
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          ''
        ).slice(0, 12) || null,
      vercel_env: process.env.VERCEL_ENV || null,
    },
    resilience: {
      onesignal_app_id_fallback: true,
      cron_auth: ['bearer', 'x-vercel-cron', 'digest_internal_key'],
      digest_scheduler: 'supabase_pg_cron',
      digest_job: 'gwa-harmattan-digest-daily',
      weather_degraded_fallback: true,
      sw_cache: 'gwa-v21-offline',
      sw_worker: 'OneSignalSDKWorker.js',
    },
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
  const publicBody = publicHealthBody(dbStatus)
  const httpStatus = dbStatus === 'connected' ? 200 : 503
  if (await isHealthOpsAuthorized(request)) {
    return NextResponse.json(
      { ...publicBody, ...(await collectOpsDetails()) },
      { status: httpStatus, headers: HEALTH_HEADERS },
    )
  }
  return NextResponse.json(publicBody, { status: httpStatus, headers: HEALTH_HEADERS })
}
