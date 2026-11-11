import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { seedPlan } from "@/lib/pricing/quote"
import { calculateOrderTotals } from "@/lib/features/payments/calculate-order"
import {
  applyReleaseTransaction,
  decideReleasePost,
  ledgerAccountBalances,
  payInLedgerLines,
  payoutFeeFromRpc,
  payoutLedgerLines,
  prepareReleaseSplit,
  readFrozenPayoutFee,
  recordReleaseSplitOnce,
  releaseEscrowGate,
  releaseLedgerHttp,
  releaseNetAlreadyPosted,
  type EscrowOrderState,
  type LedgerLine,
  type ReleaseCommand,
  type ReleaseSplit,
} from "@/lib/features/payments/ledger"
import { sellerReceivesAfterPayoutFee } from "@/lib/features/payments/payout-fee"

/**
 * Simule gwa_post_release_split : un verrou sérialise les appels,
 * l'insertion est tout ou rien, et aucun RPC ligne à ligne n'existe.
 */
function heldOrder(id: string, escrow = "held"): EscrowOrderState {
  return {
    id,
    escrow_status: escrow,
    payment_status: "paid",
    confirmed_by_buyer_at: null,
    status: "confirmed",
  }
}

function commandFromArgs(args: Record<string, unknown>): ReleaseCommand {
  const action = args.p_action === "confirm" ? "confirm" : "release"
  return {
    transactionId: String(args.p_transaction_id),
    sellerNet: Number(args.p_seller_net),
    commission: Number(args.p_commission),
    buyerFee: Number(args.p_buyer_fee),
    payoutFee: Number(args.p_payout_fee),
    currency: String(args.p_currency || "XOF"),
    action,
    nextEscrow: args.p_next_escrow === "released" ? "released" : "held",
    nextStatus: String(args.p_next_status || ""),
    confirmedAt: args.p_confirmed_at ? String(args.p_confirmed_at) : null,
    payoutStatus: args.p_payout_status ? String(args.p_payout_status) : null,
    payoutAt: args.p_payout_at ? String(args.p_payout_at) : null,
  }
}

function transactionalLedger(seed: LedgerLine[] = [], order?: EscrowOrderState) {
  const id = seed[0]?.transactionId || order?.id || "order-pro-500"
  let lines = seed.slice()
  let current = order || heldOrder(id)
  let tail: Promise<void> = Promise.resolve()
  let failNext = false
  const calls: string[] = []
  const client = {
    calls: () => calls.slice(),
    failNextPost() {
      failNext = true
    },
    addLines(extra: LedgerLine[]) {
      lines = [...lines, ...extra]
    },
    lines(): LedgerLine[] {
      return lines.slice()
    },
    order(): EscrowOrderState {
      return { ...current }
    },
    setOrder(next: EscrowOrderState) {
      current = next
    },
    rpc(fn: string, args: Record<string, unknown>) {
      const run = tail.then(async () => {
        calls.push(fn)
        if (fn !== "gwa_post_release_split") {
          return {
            data: null,
            error: { message: `function ${fn} does not exist`, code: "42883" },
          }
        }
        if (failNext) {
          failNext = false
          return { data: null, error: { message: "insert failed mid-transaction", code: "23505" } }
        }
        const beforeLines = lines
        const beforeOrder = current
        const applied = applyReleaseTransaction(current, lines, commandFromArgs(args))
        if (!applied.ok) {
          lines = beforeLines
          current = beforeOrder
          return { data: null, error: { message: applied.code, code: "P0001" } }
        }
        lines = applied.lines
        current = applied.order
        return { data: { ok: true, skipped: applied.skipped }, error: null }
      })
      tail = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
  return client
}

const proSplit: ReleaseSplit = {
  transactionId: "order-pro-500",
  sellerNet: 470,
  commission: 30,
  buyerFee: 0,
  payoutFee: 0,
  currency: "XOF",
}

function mirror(lines: LedgerLine[]): LedgerLine[] {
  return lines.map((line) => ({
    ...line,
    debitAccount: line.creditAccount,
    creditAccount: line.debitAccount,
  }))
}

describe("grand livre — sens du séquestre", () => {
  it("crédite le séquestre du brut tant que la commande n'est pas libérée", () => {
    const payIn = payInLedgerLines({ transactionId: "order-payin", totalPaid: 500 })
    expect(payIn).toEqual([
      {
        transactionId: "order-payin",
        debitAccount: "GATEWAY_GENIUSPAY",
        creditAccount: "ESCROW_GWA",
        amount: 500,
        currency: "XOF",
      },
    ])
    const balances = ledgerAccountBalances(payIn)
    expect(balances.ESCROW_GWA).toBe(500)
    expect(balances.GATEWAY_GENIUSPAY).toBe(-500)
    expect(balances.WALLET_SELLER ?? 0).toBe(0)
  })

  it("solde le séquestre d'une commande 500 F : 470 au vendeur, 30 de commission, sans frais", () => {
    const id = "order-pro-500"
    const lines = [
      ...payInLedgerLines({ transactionId: id, totalPaid: 500 }),
      ...payoutLedgerLines({ transactionId: id, sellerNet: 470, commission: 30, buyerFee: 0, payoutFee: 0 }),
    ]
    const balances = ledgerAccountBalances(lines)
    expect(balances.ESCROW_GWA).toBe(0)
    expect(balances.WALLET_SELLER).toBe(470)
    expect(balances.REVENUE_GWA).toBe(30)
    expect(balances.GATEWAY_GENIUSPAY).toBe(-500)
  })

  it("attribue les frais acheteur et de versement sans laisser de solde au séquestre", () => {
    const totals = calculateOrderTotals(10_000, 1, seedPlan("PRO"), {
      buyer_service_fee_fixed: 250,
    })
    const payoutFee = 300
    const sellerNet = sellerReceivesAfterPayoutFee(totals.sellerNet, payoutFee)
    const id = "order-pro-fees"
    const lines = [
      ...payInLedgerLines({ transactionId: id, totalPaid: totals.totalPaid }),
      ...payoutLedgerLines({
        transactionId: id,
        sellerNet,
        commission: totals.commission,
        buyerFee: totals.buyerFee,
        payoutFee,
      }),
    ]
    expect(totals.buyerFee).toBe(250)
    expect(sellerNet + totals.commission + totals.buyerFee + payoutFee).toBe(totals.totalPaid)
    const balances = ledgerAccountBalances(lines)
    expect(balances.ESCROW_GWA).toBe(0)
    expect(balances.WALLET_SELLER).toBe(sellerNet)
    expect(balances.REVENUE_GWA).toBe(totals.commission)
    expect(balances.REVENUE_GWA_BUYER_FEE).toBe(250)
    expect(balances.REVENUE_GWA_PAYOUT).toBe(300)
    expect(balances.GATEWAY_GENIUSPAY).toBe(-totals.totalPaid)
  })
})

describe("ventilation — frais figé et somme", () => {
  it("refuse un frais absent, et accepte un frais figé à zéro", () => {
    expect(readFrozenPayoutFee(null).ok).toBe(false)
    expect(readFrozenPayoutFee(undefined).ok).toBe(false)
    expect(readFrozenPayoutFee(0)).toEqual({ ok: true, fee: 0 })
    const failed = payoutFeeFromRpc({ data: null, error: { message: "gwa_payout_fee down" } })
    expect(failed).toEqual({ ok: false, code: "payout_fee_failed" })
    if (!failed.ok) {
      expect(releaseLedgerHttp(failed)).toMatchObject({ status: 503, mutateOrder: false })
    }
  })

  it("refuse disputed, refunded et released : seul held + paid passe", () => {
    expect(releaseEscrowGate({ payment_status: "paid", escrow_status: "held" }).ok).toBe(true)
    for (const escrow_status of ["disputed", "refunded", "released", "pending"]) {
      const gate = releaseEscrowGate({ payment_status: "paid", escrow_status })
      expect(gate.ok).toBe(false)
      if (!gate.ok) expect(gate.status).toBe(409)
    }
    expect(releaseEscrowGate({ payment_status: "refunded", escrow_status: "held" }).ok).toBe(false)
  })

  it("refuse une livraison dans le brut qui n'est pas dans la ventilation", () => {
    const refused = prepareReleaseSplit({
      id: "order-shipping",
      total_amount: 600,
      vendeur_recoit_fcfa: 470,
      commission_fcfa: 30,
      buyer_service_fee: 0,
      service_fee: 0,
      payout_fee_frozen_fcfa: 0,
    })
    expect(refused).toMatchObject({ ok: false, code: "split_mismatch", gross: 600, splitSum: 500 })
  })

  it("refuse le repli total − commission − service_fee quand la somme n'est pas le brut", () => {
    const refused = prepareReleaseSplit({
      id: "order-mismatch",
      total_amount: 500,
      commission_fcfa: 30,
      service_fee: 10,
      buyer_service_fee: 0,
      payout_fee_frozen_fcfa: 0,
    })
    expect(refused).toMatchObject({ ok: false, code: "split_mismatch", gross: 500, splitSum: 490 })
    expect(releaseLedgerHttp(refused as never).mutateOrder).toBe(false)
  })

  it("accepte 500 / 470 / 30 quand le frais figé est zéro", () => {
    expect(
      prepareReleaseSplit({
        id: "order-pro-500",
        total_amount: 500,
        vendeur_recoit_fcfa: 470,
        commission_fcfa: 30,
        buyer_service_fee: 0,
        payout_fee_frozen_fcfa: 0,
        currency: "XOF",
      }),
    ).toEqual({ ok: true, split: proSplit })
  })

  it("refuse la libération si le livre n'a pas l'encaissement ou si la somme ≠ solde séquestre", async () => {
    const bare = transactionalLedger()
    const missing = await recordReleaseSplitOnce(bare, proSplit)
    expect(missing).toMatchObject({ ok: false, code: "pay_in_missing" })
    expect(bare.lines()).toHaveLength(0)

    const short = transactionalLedger(payInLedgerLines({ transactionId: proSplit.transactionId, totalPaid: 400 }))
    const mismatch = await recordReleaseSplitOnce(short, proSplit)
    expect(mismatch).toMatchObject({ ok: false, code: "split_mismatch" })
    expect(short.lines()).toHaveLength(1)
    expect(short.order().escrow_status).toBe("held")
    expect(releaseLedgerHttp(mismatch).status).toBe(409)
    expect(releaseLedgerHttp(mismatch).mutateOrder).toBe(false)
  })
})

describe("ventilation — solde net, extourne, atomicité", () => {
  it("libère, extourne en miroir, relibère une fois, puis bloque la suivante", async () => {
    const id = proSplit.transactionId
    const client = transactionalLedger(payInLedgerLines({ transactionId: id, totalPaid: 500 }))
    const first = await recordReleaseSplitOnce(client, proSplit)
    expect(first).toEqual({ ok: true, skipped: false })
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(470)

    const release = payoutLedgerLines(proSplit)
    client.addLines(mirror(release))
    expect(releaseNetAlreadyPosted(client.lines(), id)).toBe(false)
    expect(ledgerAccountBalances(client.lines()).ESCROW_GWA).toBe(500)
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(0)

    client.setOrder(heldOrder(id))
    const again = await recordReleaseSplitOnce(client, proSplit)
    const blocked = await recordReleaseSplitOnce(client, proSplit)
    expect(again).toEqual({ ok: true, skipped: false })
    expect(blocked).toMatchObject({ ok: false, code: "escrow_not_held" })
    client.setOrder(heldOrder(id))
    const heldAgain = await recordReleaseSplitOnce(client, proSplit)
    expect(heldAgain).toEqual({ ok: true, skipped: true })
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(470)
    expect(ledgerAccountBalances(client.lines()).REVENUE_GWA).toBe(30)
    expect(ledgerAccountBalances(client.lines()).ESCROW_GWA).toBe(0)
    expect(client.calls().every((fn) => fn === "gwa_post_release_split")).toBe(true)
  })

  it("ignore le statut held : des écritures déjà ouvertes ne sont pas repostées", async () => {
    const id = proSplit.transactionId
    const escrowStatus = "held"
    const existing = [
      ...payInLedgerLines({ transactionId: id, totalPaid: 500 }),
      ...payoutLedgerLines(proSplit),
    ]
    const client = transactionalLedger(existing)
    const result = await recordReleaseSplitOnce(client, proSplit)
    expect(escrowStatus).toBe("held")
    expect(result).toEqual({ ok: true, skipped: true })
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(470)
    expect(client.lines().filter((line) => line.creditAccount === "WALLET_SELLER")).toHaveLength(1)
  })

  it("sérialise deux libérations concurrentes : une seule ventilation", async () => {
    const client = transactionalLedger(
      payInLedgerLines({ transactionId: proSplit.transactionId, totalPaid: 500 }),
    )
    const [left, right] = await Promise.all([
      recordReleaseSplitOnce(client, proSplit),
      recordReleaseSplitOnce(client, proSplit),
    ])
    const posted = [left, right].filter((result) => result.ok && !result.skipped)
    expect(posted).toHaveLength(1)
    expect(ledgerAccountBalances(client.lines()).ESCROW_GWA).toBe(0)
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(470)
    expect(client.lines().filter((line) => line.creditAccount === "WALLET_SELLER")).toHaveLength(1)
  })

  it("un échec au milieu de la transaction ne laisse aucune ligne de ventilation", async () => {
    const payIn = payInLedgerLines({ transactionId: proSplit.transactionId, totalPaid: 500 })
    const client = transactionalLedger(payIn)
    client.failNextPost()
    const failed = await recordReleaseSplitOnce(client, proSplit)
    expect(failed).toMatchObject({ ok: false, code: "ledger_failed" })
    expect(client.lines()).toEqual(payIn)
    expect(client.calls()).toEqual(["gwa_post_release_split"])
    expect(releaseLedgerHttp(failed)).toMatchObject({ status: 503, mutateOrder: false })

    const retried = await recordReleaseSplitOnce(client, proSplit)
    expect(retried).toEqual({ ok: true, skipped: false })
    expect(ledgerAccountBalances(client.lines()).WALLET_SELLER).toBe(470)
  })

  it("une fonction absente répond 503 et n'écrit rien, sans repli ligne à ligne", async () => {
    const calls: string[] = []
    const missing = await recordReleaseSplitOnce(
      {
        rpc(fn: string) {
          calls.push(fn)
          return Promise.resolve({
            data: null,
            error: {
              message: "Could not find the function public.gwa_post_release_split in the schema cache",
              code: "PGRST202",
            },
          })
        },
      },
      proSplit,
    )
    expect(missing).toMatchObject({ ok: false, code: "function_missing", missing: true })
    expect(calls).toEqual(["gwa_post_release_split"])
    expect(releaseLedgerHttp(missing)).toEqual({
      status: 503,
      mutateOrder: false,
      body: {
        error: "L’écriture comptable n’a pas pu être enregistrée.",
        code: "function_missing",
      },
    })
  })
})

describe("migration 076", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "scripts/schema/076_gwa_post_release_split.sql"),
    "utf8",
  )

  it("verrouille, contrôle le pay-in et le net, et n'accorde l'exécution qu'à service_role", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\(p_transaction_id::text\)::bigint\)/)
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/search_path = public/)
    expect(sql).toMatch(/account_debit = 'GATEWAY_GENIUSPAY'/)
    expect(sql).toMatch(/account_credit = 'ESCROW_GWA'/)
    expect(sql).toMatch(/starts_with\(account, 'REVENUE_'\)/)
    expect(sql).toMatch(/WHERE net > 0/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.gwa_post_release_split/)
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.gwa_post_release_split[\s\S]*TO service_role/)
    expect(sql).toMatch(/FOR UPDATE/)
    expect(sql).toMatch(/confirmed_by_buyer_at IS NULL/)
    expect(sql).toMatch(/RAISE EXCEPTION 'escrow_not_held'/)
    expect(sql).toMatch(/ALTER COLUMN transaction_id SET NOT NULL/)
    expect(sql).not.toMatch(/ON CONFLICT/)
    expect(sql).not.toMatch(/UPDATE\s+public\.orders\s+SET\s+payout_fee_frozen_fcfa/i)
    expect(sql).toMatch(/payout_fee_frozen_fcfa/)
    expect(sql).toMatch(/payout_plan_id_at_payment/)
    expect(sql).toMatch(/DROP INDEX IF EXISTS public\.financial_ledger_pair_uidx/)
  })

  it("ne poste pas la ventilation via gwa_record_ledger_entry", () => {
    const body = sql.slice(sql.indexOf("FUNCTION public.gwa_post_release_split"))
    expect(body).not.toMatch(/gwa_record_ledger_entry/)
    const decision = decideReleasePost(
      payInLedgerLines({ transactionId: "order-pro-500", totalPaid: 500 }),
      payoutLedgerLines(proSplit),
      "order-pro-500",
    )
    expect(decision.ok && !decision.skipped && decision.lines).toHaveLength(2)
  })
})
