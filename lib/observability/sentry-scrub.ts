/**
 * Nettoyage des événements Sentry avant envoi (client, serveur, edge).
 * Sans dépendance Node : utilisable dans le runtime edge.
 * Retire cookies, en-têtes d’autorisation, IP et e-mail de l’utilisateur,
 * corps de requête, et masque e-mails / téléphones / IBAN dans les textes.
 * Retire aussi la valeur des paramètres d'URL sensibles (token=, access_token=,
 * code=, apikey=, signature=…) dans l'URL, la query string, les breadcrumbs et
 * tout autre texte de l'événement, y compris dans un fragment (#access_token=).
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

/** Paramètres d'URL dont la valeur ne doit jamais partir chez Sentry (insensible à la casse). */
export const SENSITIVE_QUERY_PARAMS = [
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "provider_token",
  "provider_refresh_token",
  "token_hash",
  "auth",
  "authorization",
  "code",
  "otp",
  "key",
  "apikey",
  "api_key",
  "secret",
  "client_secret",
  "password",
  "pwd",
  "signature",
  "sig",
  "session",
  "session_id",
  "jwt",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "x-goog-signature",
]

export const FILTERED = "[Filtered]"

const SENSITIVE_PARAM_SET = new Set(SENSITIVE_QUERY_PARAMS)
// Début de texte, espace, ?, &, ; ou # (fragment), puis nom sensible, puis =valeur.
const SENSITIVE_PARAM_RE = new RegExp(
  `(^|[\\s?&#;])(${SENSITIVE_QUERY_PARAMS.join("|")})=([^&#\\s"'<>]*)`,
  "gi",
)

/** Remplace la valeur des paramètres sensibles dans une URL ou un texte qui en contient. */
export function scrubSensitiveQuery(text: string): string {
  if (!text.includes("=")) return text
  return text.replace(SENSITIVE_PARAM_RE, (_m, sep: string, name: string) => `${sep}${name}=${FILTERED}`)
}

function scrubText(text: string): string {
  return maskContactPii(scrubSensitiveQuery(text))
}

function scrubQueryString(qs: unknown): unknown {
  if (typeof qs === "string") return scrubText(qs)
  if (Array.isArray(qs)) {
    return qs.map((pair) =>
      Array.isArray(pair) && typeof pair[0] === "string"
        ? [pair[0], SENSITIVE_PARAM_SET.has(pair[0].toLowerCase()) ? FILTERED : scrubValue(pair[1])]
        : scrubValue(pair),
    )
  }
  if (typeof qs === "object" && qs !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(qs)) {
      out[k] = SENSITIVE_PARAM_SET.has(k.toLowerCase()) ? FILTERED : scrubValue(v)
    }
    return out
  }
  return undefined
}

type Dict = Record<string, unknown>

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Parcourt récursivement et masque les chaînes (profondeur bornée). */
export function scrubValue<T>(value: T, depth = 0): T {
  if (depth > 8) return value
  if (typeof value === "string") return scrubText(value) as unknown as T
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
    out[k] = typeof v === "string" ? scrubText(v) : v
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
    if (typeof request.url === "string") request.url = scrubText(request.url)
    if (request.query_string !== undefined) {
      const qs = scrubQueryString(request.query_string)
      if (qs === undefined) delete request.query_string
      else request.query_string = qs
    }
  }
  const user = e.user
  if (isDict(user)) {
    delete user.email
    delete user.ip_address
    delete user.username
  }
  for (const key of ["message", "exception", "breadcrumbs", "extra", "contexts", "tags", "logentry", "transaction", "spans"]) {
    if (e[key] !== undefined) e[key] = scrubValue(e[key])
  }
  return event
}
