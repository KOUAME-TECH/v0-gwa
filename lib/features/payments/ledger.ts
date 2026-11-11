import { sellerReceivesAfterPayoutFee } from "@/lib/features/payments/payout-fee"

export type LedgerLine = {
  transactionId: string
  debitAccount: string
  creditAccount: string
  amount: number
  currency: string
}

/**
 * Sens des soldes de `ledgerAccountBalances` : crédit − débit.
 * ESCROW_GWA est un passif (dû aux parties) : le pay-in le crédite, la
 * libération le débite. WALLET_SELLER et les comptes REVENUE_* sont positifs
 * quand ils détiennent le net ou les frais. GATEWAY_GENIUSPAY est le compte
 * de passage : il est débité du brut encaissé, donc son solde vaut −brut.
 * Après pay-in + libération d'une même transaction, ESCROW_GWA vaut 0.
 */
export const ESCROW_ACCOUNT = "ESCROW_GWA"
export const GATEWAY_ACCOUNT = "GATEWAY_GENIUSPAY"
export const SELLER_WALLET_ACCOUNT = "WALLET_SELLER"

const RELEASE_CREDIT_ACCOUNTS = new Set([
  SELLER_WALLET_ACCOUNT,
  "REVENUE_GWA",
  "REVENUE_GWA_BUYER_FEE",
  "REVENUE_GWA_PAYOUT",
])

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
      debitAccount: GATEWAY_ACCOUNT,
      creditAccount: ESCROW_ACCOUNT,
      amount,
      currency: input.currency || "XOF",
    },
  ]
}

/** Libération : débit du passif ESCROW_GWA, crédit du vendeur et des produits. */
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
  push(ESCROW_ACCOUNT, SELLER_WALLET_ACCOUNT, input.sellerNet)
  push(ESCROW_ACCOUNT, "REVENUE_GWA", input.commission)
  push(ESCROW_ACCOUNT, "REVENUE_GWA_BUYER_FEE", input.buyerFee || 0)
  push(ESCROW_ACCOUNT, "REVENUE_GWA_PAYOUT", input.payoutFee || 0)
  return lines
}

type ReleaseOrder = {
  id: string
  vendeur_recoit_fcfa?: unknown
  total_amount?: unknown
  commission_fcfa?: unknown
  seller_commission?: unknown
  service_fee?: unknown
  buyer_service_fee?: unknown
  currency?: string | null
}

function roundFcfa(value: unknown): number {
  const rounded = Math.round(Number(value) || 0)
  return Number.isFinite(rounded) ? rounded : 0
}

/** Même ventilation que la confirmation acheteur : net après frais de versement. */
export function buildReleaseLedgerInput(order: ReleaseOrder, payoutFee: number) {
  const sellerBefore =
    order.vendeur_recoit_fcfa != null
      ? roundFcfa(order.vendeur_recoit_fcfa)
      : Math.max(
          0,
          roundFcfa(order.total_amount) - roundFcfa(order.commission_fcfa) - roundFcfa(order.service_fee),
        )
  const fee = Math.min(Math.max(sellerBefore, 0), Math.max(0, roundFcfa(payoutFee)))
  return {
    transactionId: order.id,
    sellerNet: sellerReceivesAfterPayoutFee(sellerBefore, fee),
    commission: roundFcfa(order.commission_fcfa ?? order.seller_commission),
    buyerFee: roundFcfa(order.buyer_service_fee),
    payoutFee: fee,
    currency: order.currency || "XOF",
  }
}

/** Compare les totaux. Ne prouve pas que chaque compte est soldé : voir `ledgerAccountBalances`. */
export function ledgerIsBalanced(payIn: LedgerLine[], payout: LedgerLine[]): boolean {
  const payInTotal = payIn.reduce((sum, line) => sum + line.amount, 0)
  const payoutTotal = payout.reduce((sum, line) => sum + line.amount, 0)
  return payInTotal === payoutTotal && payInTotal > 0
}

export function ledgerAccountBalances(lines: LedgerLine[]): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const line of lines) {
    balances[line.debitAccount] = (balances[line.debitAccount] ?? 0) - line.amount
    balances[line.creditAccount] = (balances[line.creditAccount] ?? 0) + line.amount
  }
  return balances
}

/**
 * Vrai si cette transaction a déjà une jambe de libération
 * (ESCROW_GWA → WALLET_SELLER ou un compte REVENUE_*).
 * Le statut escrow ne compte pas : une correction peut laisser les écritures
 * alors que `escrow_status` vaut encore `held`.
 */
export function releaseSplitAlreadyPosted(lines: LedgerLine[], transactionId: string): boolean {
  return lines.some(
    (line) =>
      line.transactionId === transactionId &&
      line.debitAccount === ESCROW_ACCOUNT &&
      RELEASE_CREDIT_ACCOUNTS.has(line.creditAccount),
  )
}

/** Lignes à ajouter. Tableau vide si la ventilation est déjà dans le livre. */
export function releaseLinesToAppend(existing: LedgerLine[], proposed: LedgerLine[]): LedgerLine[] {
  const transactionId = proposed[0]?.transactionId
  if (!transactionId || proposed.length === 0) return []
  if (releaseSplitAlreadyPosted(existing, transactionId)) return []
  return proposed
}

type LedgerCall = { error: { message: string } | null }

type LedgerClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LedgerCall>
}

type LedgerRow = {
  transaction_id?: string | null
  account_debit?: string | null
  account_credit?: string | null
  amount?: number | null
  currency?: string | null
}

type LedgerRead = { data: LedgerRow[] | null; error: { message: string } | null }

type LedgerReader = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<LedgerRead>
    }
  }
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

function rowsToLines(rows: LedgerRow[]): LedgerLine[] {
  return rows.flatMap((row) => {
    if (!row.transaction_id || !row.account_debit || !row.account_credit) return []
    const amount = Math.round(Number(row.amount) || 0)
    if (amount <= 0) return []
    return [
      {
        transactionId: row.transaction_id,
        debitAccount: row.account_debit,
        creditAccount: row.account_credit,
        amount,
        currency: row.currency || "XOF",
      },
    ]
  })
}

/**
 * Poste la ventilation de libération une seule fois pour la transaction.
 * Si une jambe ESCROW_GWA → WALLET_SELLER / REVENUE_* existe déjà, ne réécrit rien.
 * Une lecture impossible bloque l'écriture : on ne devine pas que le livre est vide.
 */
export async function recordReleaseSplitOnce(
  client: LedgerClient & LedgerReader,
  input: {
    transactionId: string
    sellerNet: number
    commission: number
    buyerFee?: number
    payoutFee?: number
    currency?: string
  },
): Promise<{ ok: true; skipped: boolean } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("financial_ledger")
    .select("transaction_id, account_debit, account_credit, amount, currency")
    .eq("transaction_id", input.transactionId)
  if (error) return { ok: false, error: "L’écriture comptable n’a pas pu être enregistrée." }
  const existing = rowsToLines(data || [])
  const proposed = payoutLedgerLines(input)
  const toPost = releaseLinesToAppend(existing, proposed)
  if (toPost.length === 0) return { ok: true, skipped: true }
  const recorded = await recordLedgerLines(client, toPost)
  if (!recorded.ok) return recorded
  return { ok: true, skipped: false }
}
