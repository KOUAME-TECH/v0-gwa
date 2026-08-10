import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authorizeCronRequest } from "@/lib/security/cron-auth"
import {
  evaluateMoneyInvariants,
  summarizeFindings,
  type SelfHealFinding,
} from "@/lib/ops/self-heal"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET|POST /api/cron/self-heal
 * Scan des invariants argent (auto-régulation) — lecture seule + audit log.
 * Auth: Bearer CRON_SECRET.
 */
async function handle(request: Request) {
  const auth = authorizeCronRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id, order_number, payment_status, escrow_status, payout_status, status, total_amount",
    )
    .in("payment_status", ["paid", "processing"])
    .order("updated_at", { ascending: false })
    .limit(80)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const findings: (SelfHealFinding & { order_id: string })[] = []
  for (const o of orders || []) {
    for (const f of evaluateMoneyInvariants(o)) {
      findings.push({ ...f, order_id: o.id })
    }
  }

  const summary = summarizeFindings(findings)
  const critical = findings.filter((f) => f.severity === "critical").slice(0, 20)

  // Audit best-effort (ops)
  if (critical.length > 0) {
    try {
      await admin.from("admin_audit_log").insert({
        admin_id: null,
        action: "self_heal_scan",
        target_type: "orders",
        details: {
          critical: summary.critical,
          warn: summary.warn,
          sample: critical.map((c) => ({
            order_id: c.order_id,
            code: c.code,
          })),
        },
      })
    } catch {
      /* non bloquant */
    }
  }

  return NextResponse.json({
    ok: true,
    auth_via: auth.via,
    scanned: orders?.length || 0,
    ...summary,
    critical_sample: critical,
  })
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
