/** OneSignal App ID (UUID v4) — public, safe to expose client-side. */
const ONESIGNAL_APP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * App ID public GWA (Fourni ops) — secours si env Vercel manquant / mal formé.
 * Ne jamais y mettre la REST API key.
 */
export const GWA_ONESIGNAL_APP_ID = "5f01e343-a7a2-4ae8-8baa-655388e239bc"

/**
 * Origines web push attendues (dashboard OneSignal → Settings → Platforms → Web).
 * Init client soft-fail hors allowlist pour éviter SW cassé / erreurs non catchées.
 * Ajouter toute nouvelle alias Vercel / domaine custom ici + dans le dashboard.
 */
export const GWA_ONESIGNAL_ALLOWED_ORIGINS = [
  "https://mygwa.org",
  "https://www.mygwa.org",
  "https://v0-gwa-gwa.vercel.app",
  "https://v0-gwa-mu.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const

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
 * True si l'origine est allowlistée pour OneSignal.init.
 * Alias preview `v0-gwa-*.vercel.app` acceptés (projet GWA) ; sinon liste exacte.
 */
export function isOneSignalOriginAllowed(origin: string): boolean {
  const o = (origin || "").trim().replace(/\/$/, "")
  if (!o) return false
  if ((GWA_ONESIGNAL_ALLOWED_ORIGINS as readonly string[]).includes(o)) return true
  try {
    const u = new URL(o)
    if (u.protocol !== "https:") return false
    // Preview / prod aliases du projet v0-gwa sur Vercel
    if (
      u.hostname === "v0-gwa-gwa.vercel.app" ||
      u.hostname === "v0-gwa-mu.vercel.app" ||
      /^v0-gwa(-[a-z0-9-]+)?\.vercel\.app$/i.test(u.hostname)
    ) {
      return true
    }
    if (u.hostname === "mygwa.org" || u.hostname === "www.mygwa.org") return true
  } catch {
    return false
  }
  return false
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
