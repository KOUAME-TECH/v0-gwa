/**
 * Breadcrumbs Sentry sans PII — parcours coopérative.
 */

type CoopEvent =
  | "coop.dashboard.load"
  | "coop.create.start"
  | "coop.create.success"
  | "coop.create.error"
  | "coop.join.start"
  | "coop.join.success"
  | "coop.invite.copy"
  | "coop.role.change"

export function trackCoopEvent(
  event: CoopEvent,
  meta?: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    const Sentry =
      typeof window !== "undefined"
        ? (window as unknown as { Sentry?: { addBreadcrumb?: (b: unknown) => void } })
            .Sentry
        : undefined
    const safeMeta: Record<string, string | number | boolean> = {}
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (v == null) continue
        if (typeof v === "string" && v.length > 80) continue
        if (/phone|email|user|token|name|address/i.test(k)) continue
        safeMeta[k] = v
      }
    }
    Sentry?.addBreadcrumb?.({
      category: "coop",
      message: event,
      level: "info",
      data: safeMeta,
    })
  } catch {
    /* never throw */
  }
}
