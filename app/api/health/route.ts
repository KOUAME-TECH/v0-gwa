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
import {
  HEALTH_HEADERS,
  isHealthOpsAuthorized,
  publicHealthBody,
} from '@/lib/ops/health'

export const dynamic = 'force-dynamic'

function envSet(name: string): boolean {
  return !!(process.env[name] || '').replace(/^"|"$/g, '').trim()
}

async function readDbStatus(): Promise<string> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    return error ? 'error' : 'connected'
  } catch {
    return 'error'
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
    app: 'GWA Platform',
    tagline: "Marche - langue Anoh, Cote d'Ivoire",
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    secrets: {
      OTP_PEPPER: otpPepper,
      CRON_SECRET: cronSecret,
      SMS_PROVIDER: smsConfigured,
      OTP_STORAGE: isOtpStoreReady(),
      SMS_AT: atKey,
      SMS_AT_USERNAME_LIVE: atLive,
      SMS_AT_SENDER_ID: atSender,
      SMS_AT_SENDER_MODE: atSender ? 'custom' : 'default',
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
      configured: geniuspayKey && geniuspaySecret,
      webhook_ready: geniuspayWebhook,
      payin_ready: geniuspayKey && geniuspaySecret,
      payout_ready: false,
    },
    sms_delivery_ready: atKey && atLive,
    sms_last_failure: await getSmsOpsFailure(),
    deploy: {
      git_sha: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || null,
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
  const dbStatus = await readDbStatus()
  const publicBody = publicHealthBody(dbStatus)
  const healthy = dbStatus === 'connected'

  if (!(await isHealthOpsAuthorized(request))) {
    return NextResponse.json(publicBody, {
      status: healthy ? 200 : 503,
      headers: HEALTH_HEADERS,
    })
  }

  return NextResponse.json(
    { ...publicBody, ...(await collectOpsDetails()) },
    { status: healthy ? 200 : 503, headers: HEALTH_HEADERS },
  )
}
