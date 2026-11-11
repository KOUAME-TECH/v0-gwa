import { describe, expect, it } from "vitest"
import { seedPlan } from "@/lib/pricing/quote"
import { calculateOrderTotals } from "@/lib/features/payments/calculate-order"
import {
  buildReleaseLedgerInput,
  ledgerAccountBalances,
  payInLedgerLines,
  payoutLedgerLines,
  recordReleaseSplitOnce,
  type LedgerLine,
} from "@/lib/features/payments/ledger"
import { sellerReceivesAfterPayoutFee } from "@/lib/features/payments/payout-fee"

type StoredRow = {
  transaction_id: string
  account_debit: string
  account_credit: string
  amount: number
  currency: string
}

/**
 * Livre en mémoire. Chaque RPC ajoute une ligne : le test doit donc refuser
 * l'appel, sinon WALLET_SELLER passe de 470 à 940.
 */
function memoryLedger(seed: LedgerLine[] = []) {
  const rows: StoredRow[] = seed.map((line) => ({
    transaction_id: line.transactionId,
    account_debit: line.debitAccount,
    account_credit: line.creditAccount,
    amount: line.amount,
    currency: line.currency,
  }))
  let rpcCalls = 0
  const client = {
    rpcCalls: () => rpcCalls,
    lines(): LedgerLine[] {
      return rows.map((row) => ({
        transactionId: row.transaction_id,
        debitAccount: row.account_debit,
        creditAccount: row.account_credit,
        amount: row.amount,
        currency: row.currency,
      }))
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls += 1
      if (fn !== "gwa_record_ledger_entry") return { error: { message: "fonction inconnue" } }
      rows.push({
        transaction_id: String(args.p_transaction_id),
        account_debit: String(args.p_debit),
        account_credit: String(args.p_credit),
        amount: Number(args.p_amount),
        currency: String(args.p_currency || "XOF"),
      })
      return { error: null }
    },
    from(table: string) {
      if (table !== "financial_ledger") throw new Error(table)
      return {
        select() {
          return {
            eq(column: string, value: string) {
              const data = rows.filter((row) => row[column as keyof StoredRow] === value)
              return Promise.resolve({ data, error: null })
            },
          }
        },
      }
    },
  }
  return client
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
    const payIn = payInLedgerLines({ transactionId: id, totalPaid: 500 })
    const release = payoutLedgerLines({
      transactionId: id,
      sellerNet: 470,
      commission: 30,
      buyerFee: 0,
      payoutFee: 0,
    })
    const balances = ledgerAccountBalances([...payIn, ...release])
    expect(balances.ESCROW_GWA).toBe(0)
    expect(balances.WALLET_SELLER).toBe(470)
    expect(balances.REVENUE_GWA).toBe(30)
    expect(balances.REVENUE_GWA_BUYER_FEE ?? 0).toBe(0)
    expect(balances.REVENUE_GWA_PAYOUT ?? 0).toBe(0)
    expect(balances.GATEWAY_GENIUSPAY).toBe(-500)
    expect(release.every((line) => line.debitAccount === "ESCROW_GWA")).toBe(true)
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

  it("ignore une seconde confirmation : le portefeuille vendeur ne double pas", async () => {
    const id = "order-confirm-twice"
    const client = memoryLedger(payInLedgerLines({ transactionId: id, totalPaid: 500 }))
    const input = { transactionId: id, sellerNet: 470, commission: 30, buyerFee: 0, payoutFee: 0 }
    const first = await recordReleaseSplitOnce(client, input)
    const second = await recordReleaseSplitOnce(client, input)
    const balances = ledgerAccountBalances(client.lines())
    expect(first).toEqual({ ok: true, skipped: false })
    expect(second).toEqual({ ok: true, skipped: true })
    expect(balances.WALLET_SELLER).toBe(470)
    expect(balances.REVENUE_GWA).toBe(30)
    expect(balances.ESCROW_GWA).toBe(0)
    expect(balances.GATEWAY_GENIUSPAY).toBe(-500)
  })

  it("ne reposte pas la ventilation quand les écritures existent et que l'escrow est encore held", async () => {
    const id = "order-held-already-split"
    const escrowStatus = "held"
    const existing = [
      ...payInLedgerLines({ transactionId: id, totalPaid: 500 }),
      ...payoutLedgerLines({
        transactionId: id,
        sellerNet: 470,
        commission: 30,
        buyerFee: 0,
        payoutFee: 0,
      }),
    ]
    const client = memoryLedger(existing)
    const callsBefore = client.rpcCalls()
    // Même décision que POST /api/orders/[id]/release et /confirm :
    // on lit le livre, pas escrow_status.
    const result = await recordReleaseSplitOnce(client, {
      transactionId: id,
      sellerNet: 470,
      commission: 30,
      buyerFee: 0,
      payoutFee: 0,
    })
    const balances = ledgerAccountBalances(client.lines())
    expect(escrowStatus).toBe("held")
    expect(result).toEqual({ ok: true, skipped: true })
    expect(client.rpcCalls()).toBe(callsBefore)
    expect(balances.WALLET_SELLER).toBe(470)
    expect(balances.REVENUE_GWA).toBe(30)
    expect(balances.ESCROW_GWA).toBe(0)
    expect(
      buildReleaseLedgerInput(
        {
          id,
          vendeur_recoit_fcfa: 470,
          total_amount: 500,
          commission_fcfa: 30,
          buyer_service_fee: 0,
          currency: "XOF",
        },
        0,
      ),
    ).toMatchObject({ sellerNet: 470, commission: 30, payoutFee: 0, buyerFee: 0 })
  })
})
