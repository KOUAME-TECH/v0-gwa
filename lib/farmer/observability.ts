/**
 * Breadcrumbs Sentry sans PII — parcours producteur.
 */

type FarmerEvent =
  | "farmer.dashboard.load"
  | "farmer.publish.start"
  | "farmer.publish.success"
  | "farmer.publish.offline_queued"
  | "farmer.wallet.withdraw_request"
  | "farmer.kyc.submit"
  | "farmer.orders.tab_ventes"

export function trackFarmerEvent(
  event: FarmerEvent,
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
        // Pas d'IDs utilisateurs / téléphones / emails
        if (/phone|email|user|token|name/i.test(k)) continue
        safeMeta[k] = v
      }
    }
    Sentry?.addBreadcrumb?.({
      category: "farmer",
      message: event,
      level: "info",
      data: safeMeta,
    })
  } catch {
    /* never throw from telemetry */
  }
}
