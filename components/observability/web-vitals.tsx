"use client"

import { useEffect } from "react"

type MetricName = "CLS" | "INP" | "LCP" | "FCP" | "TTFB"

/**
 * Lightweight CWV beacon — posts to /api/metrics when present, else no-op console in dev.
 * Avoids hard dependency on web-vitals package; uses PerformanceObserver where available.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return

    const send = (name: MetricName, value: number, rating?: string) => {
      const payload = {
        name,
        value: Math.round(name === "CLS" ? value * 1000 : value),
        rating: rating || "unknown",
        path: window.location.pathname,
        ts: Date.now(),
      }
      try {
        const body = JSON.stringify(payload)
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/metrics/web-vitals", new Blob([body], { type: "application/json" }))
        } else {
          void fetch("/api/metrics/web-vitals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          })
        }
      } catch {
        /* ignore */
      }
    }

    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint") {
          send("LCP", entry.startTime)
        }
        if (entry.entryType === "layout-shift" && !(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
          const ls = entry as PerformanceEntry & { value?: number }
          if (typeof ls.value === "number") send("CLS", ls.value)
        }
        if (entry.entryType === "event" && (entry as PerformanceEntry & { name?: string }).name === "click") {
          const ev = entry as PerformanceEntry & { duration?: number; interactionId?: number }
          if (ev.interactionId && typeof ev.duration === "number") send("INP", ev.duration)
        }
        if (entry.entryType === "paint" && entry.name === "first-contentful-paint") {
          send("FCP", entry.startTime)
        }
        if (entry.entryType === "navigation") {
          const nav = entry as PerformanceNavigationTiming
          if (nav.responseStart) send("TTFB", nav.responseStart)
        }
      }
    })

    try {
      po.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit)
      po.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit)
      po.observe({ type: "paint", buffered: true } as PerformanceObserverInit)
      po.observe({ type: "navigation", buffered: true } as PerformanceObserverInit)
      po.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    } catch {
      /* older browsers */
    }

    return () => po.disconnect()
  }, [])

  return null
}
