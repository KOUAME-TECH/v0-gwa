/**
 * Observabilité chat — breadcrumbs / métriques sans PII.
 * Pas de contenu message, pas d’email, pas de media_url.
 */

type ChatMetricEvent =
  | "chat.message.send"
  | "chat.message.outbox_flush"
  | "chat.media.upload"
  | "chat.media.sign_fail"
  | "chat.voice.record"
  | "chat.offer.create"
  | "chat.offer.accept"
  | "chat.po.print"
  | "chat.ai.advice"
  | "chat.ai.blocked"

type ChatMetricProps = {
  kind?: string
  ok?: boolean
  ms?: number
  code?: string
  offline?: boolean
}

function safeSentry(): typeof import("@sentry/nextjs") | null {
  try {
    return require("@sentry/nextjs") as typeof import("@sentry/nextjs")
  } catch {
    return null
  }
}

/** Émet un breadcrumb Sentry + compteur console en dev — jamais de PII. */
export function trackChatMetric(
  event: ChatMetricEvent,
  props: ChatMetricProps = {},
): void {
  const data: Record<string, string | number | boolean> = {}
  if (props.kind) data.kind = props.kind
  if (typeof props.ok === "boolean") data.ok = props.ok
  if (typeof props.ms === "number" && Number.isFinite(props.ms)) {
    data.ms = Math.round(props.ms)
  }
  if (props.code) data.code = String(props.code).slice(0, 40)
  if (typeof props.offline === "boolean") data.offline = props.offline

  const Sentry = safeSentry()
  if (Sentry?.addBreadcrumb) {
    Sentry.addBreadcrumb({
      category: "gwa.chat",
      message: event,
      level: props.ok === false ? "warning" : "info",
      data,
    })
  }

  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development"
  ) {
    console.debug("[gwa.chat]", event, data)
  }
}

/** Hash court non réversible pour corrélation (pas un identifiant stocké). */
export function shortCorrelationId(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8)
}
