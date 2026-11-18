/**
 * Libération du séquestre : UN SEUL chemin, la RPC transactionnelle gwa_post_release_split (077, PR #49).
 * Statut + écritures (ESCROW_GWA → WALLET_SELLER net, → REVENUE_GWA commission,
 * → REVENUE_GWA_BUYER_FEE frais acheteur, → REVENUE_GWA_PAYOUT frais de versement) dans la même
 * transaction : si une écriture échoue, le statut n'est pas modifié. Jamais de released sans écritures.
 * La RPC pose status='delivered' et payout_status NULL → 'pending_ops' (065 liste blanche).
 */
import {
  prepareReleaseSplit,
  recordReleaseSplitOnce,
  releaseEscrowGate,
  releaseLedgerHttp,
  type ReleaseAttempt,
} from "@/lib/features/payments/ledger"

type RpcClient = Parameters<typeof recordReleaseSplitOnce>[0]
type Order = Parameters<typeof prepareReleaseSplit>[0] & Parameters<typeof releaseEscrowGate>[0]

export type EscrowReleaseResult =
  | { ok: true; skipped: boolean }
  | { ok: false; status: number; body: { error: string; code: string } }

export async function releaseEscrowWithLedger(
  admin: RpcClient,
  order: Order,
  opts: { fromDispute?: boolean } = {},
): Promise<EscrowReleaseResult> {
  // Litige : le séquestre peut être frozen/disputed ; la RPC (action dispute_release) le vérifie sous verrou.
  if (!opts.fromDispute) {
    const gate = releaseEscrowGate(order)
    if (!gate.ok) return { ok: false, status: gate.status, body: { error: gate.error, code: gate.code } }
  }
  const prepared = prepareReleaseSplit(order)
  if (!prepared.ok) {
    const http = releaseLedgerHttp(prepared)
    return { ok: false, status: http.status, body: http.body! }
  }
  const result: ReleaseAttempt = await recordReleaseSplitOnce(admin, {
    ...prepared.split,
    action: opts.fromDispute ? "dispute_release" : "release",
    nextEscrow: "released",
    nextStatus: "delivered",
  })
  if (!result.ok) {
    const http = releaseLedgerHttp(result)
    return { ok: false, status: http.status, body: http.body! }
  }
  return { ok: true, skipped: result.skipped }
}
