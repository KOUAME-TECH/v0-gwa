import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  applyReleaseTransaction,
  ledgerAccountBalances,
  payInLedgerLines,
  recordReleaseSplitOnce,
  type EscrowOrderState,
  type LedgerLine,
  type ReleaseCommand,
} from "@/lib/features/payments/ledger"

/**
 * Course /confirm contre /release, même scénario que la revue QA.
 * L'ancien livre non atomique laissait ESCROW_GWA à −300.
 * Ici le verrou applique une seule ventilation et le statut ensemble.
 */
function racingBook(seed: LedgerLine[]) {
  const id = seed[0]?.transactionId || "tx"
  let lines = seed.slice()
  let order: EscrowOrderState = {
    id,
    escrow_status: "held",
    payment_status: "paid",
    confirmed_by_buyer_at: null,
    status: "confirmed",
  }
  let tail: Promise<void> = Promise.resolve()
  return {
    lines: () => lines.slice(),
    order: () => ({ ...order }),
    rpc(fn: string, args: Record<string, unknown>) {
      const run = tail.then(async () => {
        if (fn !== "gwa_post_release_split") {
          return { data: null, error: { message: `function ${fn} does not exist`, code: "42883" } }
        }
        const command: ReleaseCommand = {
          transactionId: String(args.p_transaction_id),
          sellerNet: Number(args.p_seller_net),
          commission: Number(args.p_commission),
          buyerFee: Number(args.p_buyer_fee || 0),
          payoutFee: Number(args.p_payout_fee || 0),
          currency: "XOF",
          action: args.p_action === "confirm" ? "confirm" : "release",
          nextEscrow: args.p_next_escrow === "released" ? "released" : "held",
          confirmedAt: args.p_confirmed_at ? String(args.p_confirmed_at) : null,
          payoutStatus: args.p_payout_status ? String(args.p_payout_status) : null,
        }
        const applied = applyReleaseTransaction(order, lines, command)
        if (!applied.ok) {
          return { data: null, error: { message: applied.code } }
        }
        lines = applied.lines
        order = applied.order
        return { data: { ok: true, skipped: applied.skipped }, error: null }
      })
      tail = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
}

describe("QA — concurrence confirm vs release", () => {
  it("deux ventilations concurrentes ne rendent pas le séquestre négatif", async () => {
    const tx = "00000000-0000-0000-0000-000000000001"
    const db = racingBook(payInLedgerLines({ transactionId: tx, totalPaid: 500 }))
    await Promise.all([
      recordReleaseSplitOnce(db, {
        transactionId: tx,
        sellerNet: 470,
        commission: 30,
        buyerFee: 0,
        payoutFee: 0,
        currency: "XOF",
        action: "confirm",
        nextEscrow: "held",
        confirmedAt: "2026-11-11T00:00:00.000Z",
        payoutStatus: "pending_ops",
      }),
      recordReleaseSplitOnce(db, {
        transactionId: tx,
        sellerNet: 170,
        commission: 30,
        buyerFee: 0,
        payoutFee: 300,
        currency: "XOF",
        action: "release",
      }),
    ])
    const bal = ledgerAccountBalances(db.lines())
    expect(bal.ESCROW_GWA).toBe(0)
    expect(bal.ESCROW_GWA).toBeGreaterThanOrEqual(0)
    const confirmWon = bal.WALLET_SELLER === 470 && (bal.REVENUE_GWA_PAYOUT ?? 0) === 0
    const releaseWon = bal.WALLET_SELLER === 170 && bal.REVENUE_GWA_PAYOUT === 300
    expect(confirmWon || releaseWon).toBe(true)
    expect(bal.WALLET_SELLER === 470 && bal.REVENUE_GWA_PAYOUT === 300).toBe(false)
  })

  it("lecture ou RPC en échec n'écrit ni ligne ni statut", async () => {
    const tx = "00000000-0000-0000-0000-000000000003"
    const db = racingBook(payInLedgerLines({ transactionId: tx, totalPaid: 500 }))
    const failed = await recordReleaseSplitOnce(
      {
        rpc: async () => ({ data: null, error: { message: "boom", code: "57014" } }),
      },
      {
        transactionId: tx,
        sellerNet: 470,
        commission: 30,
        buyerFee: 0,
        payoutFee: 0,
        currency: "XOF",
      },
    )
    expect(failed.ok).toBe(false)
    expect(db.lines()).toHaveLength(1)
    expect(db.order().escrow_status).toBe("held")
  })

  it("un échec avant commit ne laisse pas une commission manquante au retry", async () => {
    const tx = "00000000-0000-0000-0000-000000000002"
    const db = racingBook(payInLedgerLines({ transactionId: tx, totalPaid: 500 }))
    let failedOnce = false
    const flaky = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        if (!failedOnce) {
          failedOnce = true
          return Promise.resolve({ data: null, error: { message: "timeout" } })
        }
        return db.rpc(fn, args)
      },
    }
    const first = await recordReleaseSplitOnce(flaky, {
      transactionId: tx,
      sellerNet: 470,
      commission: 30,
      buyerFee: 0,
      payoutFee: 0,
      currency: "XOF",
      action: "release",
    })
    const second = await recordReleaseSplitOnce(db, {
      transactionId: tx,
      sellerNet: 470,
      commission: 30,
      buyerFee: 0,
      payoutFee: 0,
      currency: "XOF",
      action: "release",
    })
    expect(first.ok).toBe(false)
    expect(second).toEqual({ ok: true, skipped: false })
    expect(ledgerAccountBalances(db.lines()).ESCROW_GWA).toBe(0)
    expect(ledgerAccountBalances(db.lines()).REVENUE_GWA).toBe(30)
    expect(db.order().escrow_status).toBe("released")
  })
})

describe("routes confirm et release", () => {
  const releaseSrc = readFileSync(
    resolve(process.cwd(), "app/api/orders/[id]/release/route.ts"),
    "utf8",
  )
  const confirmSrc = readFileSync(
    resolve(process.cwd(), "app/api/orders/[id]/confirm/route.ts"),
    "utf8",
  )
  const releaseBody = releaseSrc.slice(releaseSrc.indexOf("RELEASE (admin"))

  it("ne met pas la commande à jour avec la session utilisateur", () => {
    expect(releaseBody).not.toMatch(/supabase\.from\("orders"\)/)
    expect(releaseBody).toMatch(/releaseEscrowGate/)
    expect(releaseBody).toMatch(/action: "release"/)
    expect(releaseBody).not.toMatch(/gwa_payout_fee/)
    expect(confirmSrc).not.toMatch(/gwa_payout_fee/)
    expect(confirmSrc).toMatch(/action: "confirm"/)
    expect(confirmSrc).toMatch(/if \(!ledger\.ok\)/)
  })
})
