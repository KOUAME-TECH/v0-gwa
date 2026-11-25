/**
 * IP du client, lue dans un en-tête que le visiteur ne peut pas forger.
 *
 * Sur Vercel, `x-vercel-forwarded-for` et `x-real-ip` sont posés par la plateforme.
 * `x-forwarded-for` peut contenir des entrées ajoutées par le client : sa
 * PREMIÈRE entrée est donc falsifiable. En dernier recours seulement, on prend
 * sa DERNIÈRE entrée, celle ajoutée par le proxy le plus proche.
 */
type HeaderGetter = { get(name: string): string | null }

const MAX_IP_LENGTH = 45 // IPv6 la plus longue

function clean(value: string | null | undefined): string | null {
  const v = (value || "").trim()
  if (!v || v.length > MAX_IP_LENGTH || /[\s"'<>]/.test(v)) return null
  return v
}

function firstEntry(value: string | null): string | null {
  return clean(value?.split(",")[0])
}

function lastEntry(value: string | null): string | null {
  const parts = (value || "").split(",").map((p) => p.trim()).filter(Boolean)
  return clean(parts[parts.length - 1])
}

export function resolveClientIp(headers: HeaderGetter): string {
  return (
    firstEntry(headers.get("x-vercel-forwarded-for")) ||
    clean(headers.get("x-real-ip")) ||
    lastEntry(headers.get("x-forwarded-for")) ||
    "unknown"
  )
}

/** Même règle, `null` si aucune IP fiable (colonnes d'audit nullable). */
export function resolveClientIpOrNull(headers: HeaderGetter): string | null {
  const ip = resolveClientIp(headers)
  return ip === "unknown" ? null : ip
}
