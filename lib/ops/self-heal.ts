/**
 * Auto-régulation GWA — invariants métier vérifiables (cron / health).
 * Pas de side-effects ici : pure checks + suggestions d'actions.
 */

export type SelfHealFinding = {
  code: string
  severity: "info" | "warn" | "critical"
  message: string
  hint?: string
}

export function evaluateMoneyInvariants(order: {
  payment_status?: string | null
  escrow_status?: string | null
  payout_status?: string | null
  status?: string | null
  total_amount?: number | null
}): SelfHealFinding[] {
  const out: SelfHealFinding[] = []
  const pay = order.payment_status || ""
  const escrow = order.escrow_status || ""
  const payout = order.payout_status || ""
  const status = order.status || ""

  if (pay === "paid" && escrow === "pending") {
    out.push({
      code: "ESCROW_NOT_HELD",
      severity: "critical",
      message: "Paiement paid mais escrow encore pending",
      hint: "Passer escrow → held via webhook/confirm",
    })
  }
  if (escrow === "released" && payout === "failed") {
    out.push({
      code: "RELEASED_WITHOUT_PAYOUT",
      severity: "critical",
      message: "Escrow released avec payout failed",
      hint: "Ne jamais release si payout échoue — credited_wallet ou held",
    })
  }
  if (escrow === "released" && !["paid", "credited_wallet", "skipped_sim", "skipped_zero"].includes(payout)) {
    out.push({
      code: "RELEASED_UNKNOWN_PAYOUT",
      severity: "warn",
      message: `Escrow released avec payout_status=${payout || "null"}`,
    })
  }
  if (status === "delivered" && pay !== "paid" && pay !== "refunded") {
    out.push({
      code: "DELIVERED_UNPAID",
      severity: "warn",
      message: "Commande delivered sans paiement paid",
    })
  }
  if (Number(order.total_amount) > 0 && Number(order.total_amount) < 100) {
    out.push({
      code: "AMOUNT_TOO_LOW",
      severity: "info",
      message: "Montant < 100 FCFA",
    })
  }
  return out
}

export function summarizeFindings(findings: SelfHealFinding[]): {
  critical: number
  warn: number
  ok: boolean
} {
  const critical = findings.filter((f) => f.severity === "critical").length
  const warn = findings.filter((f) => f.severity === "warn").length
  return { critical, warn, ok: critical === 0 }
}
