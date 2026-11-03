/**
 * Breadcrumbs Sentry sans PII — parcours acheteur.
 */

type BuyerEvent =
  | "buyer.dashboard.load"
  | "buyer.cart.load"
  | "buyer.cart.guest"
  | "buyer.checkout.start"
  | "buyer.checkout.success"
  | "buyer.checkout.error"
  | "buyer.confirm.reception"
  | "buyer.favorites.load"
  | "buyer.litige.open"

export function trackBuyerEvent(
  event: BuyerEvent,
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
      category: "buyer",
      message: event,
      level: "info",
      data: safeMeta,
    })
  } catch {
    /* never throw from telemetry */
  }
}
