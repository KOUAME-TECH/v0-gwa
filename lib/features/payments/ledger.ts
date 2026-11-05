export type LedgerLine = {
  transactionId: string
  debitAccount: string
  creditAccount: string
  amount: number
  currency: string
}

export function payInLedgerLines(input: {
  transactionId: string
  totalPaid: number
  currency?: string
}): LedgerLine[] {
  const amount = Math.round(input.totalPaid)
  if (amount <= 0) return []
  return [
    {
      transactionId: input.transactionId,
      debitAccount: "ESCROW_GWA",
      creditAccount: "GATEWAY_GENIUSPAY",
      amount,
      currency: input.currency || "XOF",
    },
  ]
}

export function payoutLedgerLines(input: {
  transactionId: string
  sellerNet: number
  commission: number
  buyerFee?: number
  payoutFee?: number
  currency?: string
}): LedgerLine[] {
  const currency = input.currency || "XOF"
  const lines: LedgerLine[] = []
  const push = (debit: string, credit: string, amount: number) => {
    const rounded = Math.round(amount)
    if (rounded <= 0) return
    lines.push({
      transactionId: input.transactionId,
      debitAccount: debit,
      creditAccount: credit,
      amount: rounded,
      currency,
    })
  }
  push("ESCROW_GWA", "WALLET_SELLER", input.sellerNet)
  push("ESCROW_GWA", "REVENUE_GWA", input.commission)
  push("ESCROW_GWA", "REVENUE_GWA_BUYER_FEE", input.buyerFee || 0)
  push("ESCROW_GWA", "REVENUE_GWA_PAYOUT", input.payoutFee || 0)
  return lines
}

export function ledgerIsBalanced(payIn: LedgerLine[], payout: LedgerLine[]): boolean {
  const payInTotal = payIn.reduce((sum, line) => sum + line.amount, 0)
  const payoutTotal = payout.reduce((sum, line) => sum + line.amount, 0)
  return payInTotal === payoutTotal && payInTotal > 0
}

type LedgerClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>
}

export async function recordLedgerEntry(
  client: LedgerClient,
  line: LedgerLine,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.rpc("gwa_record_ledger_entry", {
    p_transaction_id: line.transactionId,
    p_debit: line.debitAccount,
    p_credit: line.creditAccount,
    p_amount: line.amount,
    p_currency: line.currency,
  })
  if (error) return { ok: false, error: "L’écriture comptable n’a pas pu être enregistrée." }
  return { ok: true }
}

export async function recordLedgerLines(
  client: LedgerClient,
  lines: LedgerLine[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of lines) {
    const result = await recordLedgerEntry(client, line)
    if (!result.ok) return result
  }
  return { ok: true }
}
