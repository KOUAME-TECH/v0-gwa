/**
 * Nettoyage des événements Sentry avant envoi (client, serveur, edge).
 * Sans dépendance Node : utilisable dans le runtime edge.
 * Retire cookies, en-têtes d’autorisation, IP et e-mail de l’utilisateur,
 * corps de requête, et masque e-mails / téléphones / IBAN dans les textes.
 */
import { maskContactPii } from "@/lib/yelly/pii"

const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "apikey",
  "x-supabase-auth",
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
])

type Dict = Record<string, unknown>

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Parcourt récursivement et masque les chaînes (profondeur bornée). */
export function scrubValue<T>(value: T, depth = 0): T {
  if (depth > 8) return value
  if (typeof value === "string") return maskContactPii(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1)) as unknown as T
  if (isDict(value)) {
    const out: Dict = {}
    for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, depth + 1)
    return out as T
  }
  return value
}

function scrubHeaders(headers: unknown): Dict | undefined {
  if (!isDict(headers)) return undefined
  const out: Dict = {}
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase())) continue
    out[k] = typeof v === "string" ? maskContactPii(v) : v
  }
  return out
}

/**
 * `beforeSend` partagé. Générique pour rester compatible avec les types
 * `ErrorEvent` de @sentry/nextjs sans importer le SDK ici.
 */
export function scrubSentryEvent<E extends object>(event: E): E {
  const e = event as unknown as Dict
  const request = e.request
  if (isDict(request)) {
    delete request.cookies
    delete request.data
    request.headers = scrubHeaders(request.headers)
    if (typeof request.url === "string") request.url = maskContactPii(request.url)
    if (typeof request.query_string === "string") {
      request.query_string = maskContactPii(request.query_string)
    } else if (request.query_string !== undefined) {
      delete request.query_string
    }
  }
  const user = e.user
  if (isDict(user)) {
    delete user.email
    delete user.ip_address
    delete user.username
  }
  for (const key of ["message", "exception", "breadcrumbs", "extra", "contexts", "tags", "logentry"]) {
    if (e[key] !== undefined) e[key] = scrubValue(e[key])
  }
  return event
}
