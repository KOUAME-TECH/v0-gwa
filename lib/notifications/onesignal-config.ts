/** OneSignal App ID (UUID v4) — public, safe to expose client-side. */
const ONESIGNAL_APP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Strip quotes + trailing CR/LF from Vercel CLI exports on Windows. */
export function cleanEnvValue(value: string | undefined): string {
  return (value ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\r\\n$/g, "")
    .replace(/\r\n$/g, "")
    .trim()
}

export function isValidOneSignalAppId(appId: string): boolean {
  return ONESIGNAL_APP_ID_RE.test(appId)
}

/**
 * Public App ID — client + server.
 * Returns null when missing or malformed (never use a hardcoded fallback).
 */
export function getOneSignalAppId(): string | null {
  const raw =
    process.env.ONESIGNAL_APP_ID ?? process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const appId = cleanEnvValue(raw)
  if (!appId || !isValidOneSignalAppId(appId)) return null
  return appId
}

/** REST API key — server only. */
export function getOneSignalRestApiKey(): string | null {
  const key = cleanEnvValue(process.env.ONESIGNAL_REST_API_KEY)
  return key || null
}
