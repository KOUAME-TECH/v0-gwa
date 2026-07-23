/** OneSignal App ID (UUID v4) — public, safe to expose client-side. */
const ONESIGNAL_APP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * App ID public GWA (Fourni ops) — secours si env Vercel manquant / mal formé.
 * Ne jamais y mettre la REST API key.
 */
export const GWA_ONESIGNAL_APP_ID = "5f01e343-a7a2-4ae8-8baa-655388e239bc"

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
 * Env prioritaire, sinon fallback GWA hardcodé (jamais down push init).
 */
export function getOneSignalAppId(): string | null {
  const raw =
    process.env.ONESIGNAL_APP_ID ?? process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const fromEnv = cleanEnvValue(raw)
  if (fromEnv && isValidOneSignalAppId(fromEnv)) return fromEnv
  if (isValidOneSignalAppId(GWA_ONESIGNAL_APP_ID)) return GWA_ONESIGNAL_APP_ID
  return null
}

/** REST API key — server only. */
export function getOneSignalRestApiKey(): string | null {
  const key = cleanEnvValue(process.env.ONESIGNAL_REST_API_KEY)
  return key || null
}
