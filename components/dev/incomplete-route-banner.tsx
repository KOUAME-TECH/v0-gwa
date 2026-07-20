"use client"

import { getRouteStatus } from "@/lib/routes/inventory"
import { usePathname } from "next/navigation"

/**
 * Bandeau visible en développement uniquement pour les routes partial/missing.
 */
export function IncompleteRouteBanner() {
  const pathname = usePathname()
  if (process.env.NODE_ENV === "production") return null

  const entry = getRouteStatus(pathname)
  if (!entry || (entry.status !== "partial" && entry.status !== "missing")) {
    return null
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-950"
    >
      <span className="font-semibold">Route incomplète</span>
      {entry.note ? ` — ${entry.note}` : ""}
      <span className="ml-2 opacity-70">({entry.path})</span>
    </div>
  )
}
