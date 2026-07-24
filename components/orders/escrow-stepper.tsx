"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ESCROW_STEP_LABELS,
  escrowStatusMessage,
  resolveEscrowStep,
  type EscrowStatus,
} from "@/lib/orders/escrow-flow"

export type EscrowStepperProps = {
  payment_status?: string | null
  escrow_status?: EscrowStatus
  status?: string | null
  className?: string
  compact?: boolean
}

/** Stepper escrow visible — Payer → Séquestre → Livré → Confirmé → Libéré. */
export function EscrowStepper({
  payment_status,
  escrow_status,
  status,
  className,
  compact,
}: EscrowStepperProps) {
  const step = resolveEscrowStep({ payment_status, escrow_status, status })
  const frozen = escrow_status === "frozen"

  return (
    <div className={cn("rounded-2xl border border-[#1F5C2E]/12 bg-[#FFF6E5]/80 p-4", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
        Suivi de ton argent
      </p>
      <ol className={cn("mt-3 flex items-start justify-between gap-1", compact && "mt-2")}>
        {ESCROW_STEP_LABELS.map((s, i) => {
          const done = i <= step && !frozen
          const current = i === step || (frozen && i === 2)
          return (
            <li key={s.id} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  frozen && i === 2
                    ? "bg-red-500 text-white"
                    : done
                      ? "bg-[#1F5C2E] text-white"
                      : "bg-[#E5E7EB] text-[#9CA3AF]",
                  current && !frozen && "ring-2 ring-[#C27D10] ring-offset-1",
                )}
              >
                {done && i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-center text-[10px] font-medium leading-tight",
                  done || current ? "text-[#1F5C2E]" : "text-[#9CA3AF]",
                  frozen && i === 2 && "text-red-600",
                )}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>
      <p
        className={cn(
          "mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed",
          frozen ? "bg-red-50 text-red-700" : "bg-[#F0F7F2] text-[#1F5C2E]",
        )}
      >
        {escrowStatusMessage(step, escrow_status)}
      </p>
      <p className="mt-2 text-[11px] text-[#6B7280]">
        Tu paies maintenant ; le vendeur touche l’argent après ta confirmation de livraison.
      </p>
    </div>
  )
}
