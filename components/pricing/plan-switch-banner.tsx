"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

type SwitchState = {
  eligible: boolean
  threshold: number | null
  next_plan: { name: string } | null
}

export function PlanSwitchBanner() {
  const [state, setState] = useState<SwitchState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/pricing/switch")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.eligible) setState(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!state?.eligible || !state.next_plan || state.threshold == null) return null

  const threshold = new Intl.NumberFormat("fr-FR").format(state.threshold)
  const next = state.next_plan.name

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-sm ring-1 ring-[#C27D10]/30">
      <p className="font-medium text-[#111827]">
        Félicitations ! Vous avez atteint {threshold} F de ventes. Passez à {next} pour
        économiser sur vos commissions.
      </p>
      <button
        type="button"
        disabled={busy}
        className="mt-2 rounded-full bg-[#1F5C2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={async () => {
          setBusy(true)
          const res = await fetch("/api/pricing/switch", { method: "POST" })
          const data = await res.json().catch(() => ({}))
          setBusy(false)
          if (!res.ok) {
            toast.error(data.error || "Bascule impossible")
            return
          }
          toast.success(`Palier ${data.plan} activé`)
          setState(null)
        }}
      >
        Passer à {next}
      </button>
    </div>
  )
}
