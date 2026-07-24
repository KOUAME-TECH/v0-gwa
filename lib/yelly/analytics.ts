/**
 * Events Yelly — Vercel Analytics si dispo, sinon no-op silencieux.
 */
export function trackYelly(
  name: "yelly_open" | "yelly_resolved" | "yelly_escalate" | "yelly_guest_limit",
  props?: Record<string, string | number | boolean>,
) {
  try {
    // Dynamic import pattern avoided — track is sync in @vercel/analytics
    void import("@vercel/analytics").then((mod) => {
      if (typeof mod.track === "function") {
        mod.track(name, props)
      }
    })
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gwa:yelly", { detail: { name, props } }))
  }
}
