export type LedgerLine = {
  transactionId: string
  debitAccount: string
  creditAccount: string
  amount: number
  currency: string
}

/**
 * Sens des soldes de `ledgerAccountBalances` : crédit − débit.
 * ESCROW_GWA est un passif : le pay-in le crédite, la libération le débite.
 * WALLET_SELLER et REVENUE_* sont positifs quand ils détiennent le net ou les frais.
 * GATEWAY_GENIUSPAY est débité du brut, donc son solde vaut −brut.
 * Après pay-in + libération, ESCROW_GWA vaut 0.
 */
export const ESCROW_ACCOUNT = "ESCROW_GWA"
export const GATEWAY_ACCOUNT = "GATEWAY_GENIUSPAY"
export const SELLER_WALLET_ACCOUNT = "WALLET_SELLER"
export const RELEASE_SPLIT_RPC = "gwa_post_release_split"

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
  // Modèle (b) : le frais REVENUE_GWA_PAYOUT se poste au versement (079), pas ici.
  push(ESCROW_ACCOUNT, SELLER_WALLET_ACCOUNT, input.sellerNet)
  push(ESCROW_ACCOUNT, "REVENUE_GWA", input.commission)
  push(ESCROW_ACCOUNT, "REVENUE_GWA_BUYER_FEE", input.buyerFee || 0)
  return lines
}

export type ReleaseSplit = {
  transactionId: string
  sellerNet: number
  commission: number
  buyerFee: number
  payoutFee: number
  currency: string
}

export type ReleaseCommand = ReleaseSplit & {
  action?: "confirm" | "release" | "dispute_release"
  nextEscrow?: "held" | "released"
  nextStatus?: string
  confirmedAt?: string | null
  payoutStatus?: string | null
  payoutAt?: string | null
}

export type EscrowOrderState = {
  id: string
  escrow_status: string
  payment_status: string
  confirmed_by_buyer_at: string | null
  status: string
}

export type ReleaseAttempt =
  | { ok: true; skipped: boolean }
  | {
      ok: false
      code: string
      missing?: boolean
      gross?: number
      splitSum?: number
      escrowBalance?: number
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
  payout_fee_frozen_fcfa?: unknown
}

function roundFcfa(value: unknown): number {
  const rounded = Math.round(Number(value) || 0)
  return Number.isFinite(rounded) ? rounded : 0
}

/**
 * Le frais figé au paiement est `payout_fee_frozen_fcfa`.
 * NULL (colonne absente, commande antérieure au 5 nov, ou jamais payée
 * depuis la migration) n'est pas un zéro : la libération automatique est refusée.
 * `payout_fee_fcfa` (NOT NULL DEFAULT 0, écrit à la confirmation) ne remplace pas ce gel.
 */
export function readFrozenPayoutFee(
  value: unknown,
): { ok: true; fee: number } | { ok: false; code: "payout_fee_not_frozen" } {
  if (value == null || value === "") return { ok: false, code: "payout_fee_not_frozen" }
  const fee = typeof value === "number" ? value : Number(value)
  if (!Number.isSafeInteger(fee) || fee < 0) return { ok: false, code: "payout_fee_not_frozen" }
  return { ok: true, fee }
}

/** Une erreur RPC n'est jamais un frais de 0. */
export function payoutFeeFromRpc(result: {
  data: unknown
  error: { message?: string } | null
}): { ok: true; fee: number } | { ok: false; code: "payout_fee_failed" } {
  if (result.error || result.data == null || result.data === "") {
    return { ok: false, code: "payout_fee_failed" }
  }
  const fee = typeof result.data === "number" ? result.data : Number(result.data)
  if (!Number.isSafeInteger(fee) || fee < 0) return { ok: false, code: "payout_fee_failed" }
  return { ok: true, fee }
}

/** Seul un séquestre exactement held et un paiement paid peuvent être libérés. */
export function releaseEscrowGate(order: {
  escrow_status?: string | null
  payment_status?: string | null
}): { ok: true } | { ok: false; status: 409; code: "ESCROW_NOT_HELD"; error: string } {
  if (order.payment_status !== "paid" || order.escrow_status !== "held") {
    return {
      ok: false,
      status: 409,
      code: "ESCROW_NOT_HELD",
      error: "Libération refusée : le séquestre doit être held et le paiement paid.",
    }
  }
  return { ok: true }
}

/**
 * Construit la ventilation. Le repli total − commission − service_fee n'est
 * gardé que s'il reconstitue le brut (`total_amount`). Sinon refus, sans montant inventé.
 */
export function prepareReleaseSplit(
  order: ReleaseOrder,
): { ok: true; split: ReleaseSplit } | Extract<ReleaseAttempt, { ok: false }> {
  const frozen = readFrozenPayoutFee(order.payout_fee_frozen_fcfa)
  if (!frozen.ok) return frozen

  const gross = roundFcfa(order.total_amount)
  const sellerBefore =
    order.vendeur_recoit_fcfa != null
      ? roundFcfa(order.vendeur_recoit_fcfa)
      : Math.max(
          0,
          gross - roundFcfa(order.commission_fcfa) - roundFcfa(order.service_fee),
        )
  // Frais figé toujours exigé pour autoriser la libération, mais non déduit du net :
  // il se facture une fois par versement (079), pas par commande.
  const payoutFee = 0
  const sellerNet = sellerBefore
  const commission = roundFcfa(order.commission_fcfa ?? order.seller_commission)
  const buyerFee = roundFcfa(order.buyer_service_fee)
  const splitSum = sellerNet + commission + buyerFee
  if (gross <= 0 || splitSum !== gross) {
    return { ok: false, code: "split_mismatch", gross, splitSum }
  }
  return {
    ok: true,
    split: {
      transactionId: order.id,
      sellerNet,
      commission,
      buyerFee,
      payoutFee,
      currency: order.currency || "XOF",
    },
  }
}

/** Compare les totaux. Ne prouve pas que chaque compte est soldé. */
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

export function hasPayInLine(lines: LedgerLine[], transactionId: string): boolean {
  return lines.some(
    (line) =>
      line.transactionId === transactionId &&
      line.debitAccount === GATEWAY_ACCOUNT &&
      line.creditAccount === ESCROW_ACCOUNT &&
      line.amount > 0,
  )
}

/** Montant encaissé net : pay-in GATEWAY → ESCROW, moins une extourne miroir. */
export function collectedPayIn(lines: LedgerLine[], transactionId: string): number {
  return lines.reduce((sum, line) => {
    if (line.transactionId !== transactionId) return sum
    if (line.debitAccount === GATEWAY_ACCOUNT && line.creditAccount === ESCROW_ACCOUNT) {
      return sum + line.amount
    }
    if (line.debitAccount === ESCROW_ACCOUNT && line.creditAccount === GATEWAY_ACCOUNT) {
      return sum - line.amount
    }
    return sum
  }, 0)
}

/**
 * Ventilation déjà ouverte si le net (crédit − débit) de WALLET_SELLER
 * ou d'un compte REVENUE_* est > 0. Une extourne en miroir ramène le net à 0
 * et autorise une nouvelle libération, sans colonne reversal_of.
 * Aligné sur `gwa_post_release_split`.
 */
export function releaseNetAlreadyPosted(lines: LedgerLine[], transactionId: string): boolean {
  const balances = ledgerAccountBalances(lines.filter((line) => line.transactionId === transactionId))
  return Object.entries(balances).some(([account, net]) => {
    if (net <= 0) return false
    return account === SELLER_WALLET_ACCOUNT || account.startsWith("REVENUE_")
  })
}

export type ReleaseDecision =
  | { ok: true; skipped: false; lines: LedgerLine[] }
  | { ok: true; skipped: true; reason: "already_posted" }
  | { ok: false; code: "pay_in_missing" | "split_mismatch"; escrowBalance?: number; splitSum?: number }

/**
 * Même ordre que `gwa_post_release_split` : pay-in, somme = encaissé = solde
 * séquestre, puis net déjà ouvert. Une ventilation incomplète n'est pas « déjà postée ».
 */
export function decideReleasePost(
  existing: LedgerLine[],
  proposed: LedgerLine[],
  transactionId: string,
): ReleaseDecision {
  const scoped = existing.filter((line) => line.transactionId === transactionId)
  if (!hasPayInLine(scoped, transactionId)) return { ok: false, code: "pay_in_missing" }
  const escrowBalance = ledgerAccountBalances(scoped)[ESCROW_ACCOUNT] ?? 0
  const collected = collectedPayIn(scoped, transactionId)
  const splitSum = proposed.reduce((sum, line) => sum + line.amount, 0)
  if (releaseNetAlreadyPosted(scoped, transactionId)) {
    if (escrowBalance !== 0) {
      return { ok: false, code: "split_mismatch", escrowBalance, splitSum }
    }
    return { ok: true, skipped: true, reason: "already_posted" }
  }
  if (splitSum !== escrowBalance || splitSum !== collected) {
    return { ok: false, code: "split_mismatch", escrowBalance, splitSum }
  }
  return { ok: true, skipped: false, lines: proposed }
}

export type ReleaseTransition =
  | { ok: true; skipped: boolean; order: EscrowOrderState; lines: LedgerLine[] }
  | { ok: false; code: string; order: EscrowOrderState; lines: LedgerLine[] }

/**
 * Effet de la RPC : statut et lignes bougent ensemble, ou pas du tout.
 * `escrow_status` autre que held, ou paiement autre que paid, ne change rien.
 */
export function applyReleaseTransaction(
  order: EscrowOrderState,
  lines: LedgerLine[],
  command: ReleaseCommand,
): ReleaseTransition {
  if (order.payment_status !== "paid" || order.escrow_status !== "held") {
    return { ok: false, code: "escrow_not_held", order, lines }
  }
  if ((command.action ?? "release") === "confirm" && order.confirmed_by_buyer_at) {
    return { ok: false, code: "already_confirmed", order, lines }
  }
  const proposed = payoutLedgerLines(command)
  const decision = decideReleasePost(lines, proposed, command.transactionId)
  if (!decision.ok) return { ok: false, code: decision.code, order, lines }
  const action = command.action ?? "release"
  const next: EscrowOrderState = {
    ...order,
    escrow_status: action === "release" ? "released" : command.nextEscrow || "held",
    status: "delivered",
    confirmed_by_buyer_at:
      action === "confirm" ? command.confirmedAt || new Date(0).toISOString() : order.confirmed_by_buyer_at,
  }
  return {
    ok: true,
    skipped: decision.skipped,
    order: next,
    lines: decision.skipped ? lines : [...lines, ...decision.lines],
  }
}

type LedgerCall = {
  data?: unknown
  error: { message: string; code?: string } | null
}

type LedgerClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LedgerCall>
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

export function isMissingReleaseFunction(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42883" || error.code === "PGRST202") return true
  const message = error.message || ""
  return /gwa_post_release_split/i.test(message) && /does not exist|could not find|schema cache|introuvable/i.test(message)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Un seul RPC `gwa_post_release_split`. Pas de lecture puis d'écritures ligne à ligne.
 * Fonction absente : échec, sans repli. L'appelant ne doit pas modifier la commande.
 */
function refusalFromMessage(message: string): string | null {
  if (/escrow_not_held/i.test(message)) return "escrow_not_held"
  if (/already_confirmed/i.test(message)) return "already_confirmed"
  if (/escrow_conflict/i.test(message)) return "escrow_conflict"
  if (/split_mismatch/i.test(message)) return "split_mismatch"
  if (/pay_in_missing/i.test(message)) return "pay_in_missing"
  return null
}

export async function recordReleaseSplitOnce(
  client: LedgerClient,
  input: ReleaseCommand,
): Promise<ReleaseAttempt> {
  const action = input.action ?? "release"
  let response: LedgerCall
  try {
    response = await client.rpc(RELEASE_SPLIT_RPC, {
      p_transaction_id: input.transactionId,
      p_seller_net: input.sellerNet,
      p_commission: input.commission,
      p_buyer_fee: input.buyerFee,
      p_payout_fee: input.payoutFee,
      p_currency: input.currency,
      p_action: action,
      p_next_escrow: action === "confirm" ? input.nextEscrow || "held" : "released",
      p_next_status: "delivered",
      p_confirmed_at: input.confirmedAt ?? null,
      p_payout_status: input.payoutStatus ?? null,
      p_payout_at: input.payoutAt ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "ledger"
    const missing = isMissingReleaseFunction({ message })
    return {
      ok: false,
      code: missing ? "function_missing" : refusalFromMessage(message) || "ledger_failed",
      missing,
    }
  }
  if (response.error) {
    const missing = isMissingReleaseFunction(response.error)
    const message = response.error.message || ""
    return {
      ok: false,
      code: missing ? "function_missing" : refusalFromMessage(message) || "ledger_failed",
      missing,
    }
  }
  const data = asRecord(response.data)
  if (data?.ok === true) return { ok: true, skipped: data.skipped === true }
  if (data?.ok === false) {
    return {
      ok: false,
      code: String(data.error || "ledger_failed"),
      escrowBalance: typeof data.escrow_balance === "number" ? data.escrow_balance : undefined,
      splitSum: typeof data.split_sum === "number" ? data.split_sum : undefined,
    }
  }
  return { ok: false, code: "ledger_failed" }
}

const RELEASE_HTTP: Record<string, { status: number; error: string }> = {
  function_missing: { status: 503, error: "L’écriture comptable n’a pas pu être enregistrée." },
  ledger_failed: { status: 503, error: "L’écriture comptable n’a pas pu être enregistrée." },
  pay_in_missing: {
    status: 409,
    error: "Libération refusée : aucun encaissement GATEWAY_GENIUSPAY → ESCROW_GWA dans le livre.",
  },
  split_mismatch: {
    status: 409,
    error: "Libération refusée : la ventilation ne solde pas le séquestre.",
  },
  payout_fee_not_frozen: {
    status: 409,
    error: "Frais de versement non figé au paiement. Revue manuelle requise, sans recalcul.",
  },
  payout_fee_failed: {
    status: 503,
    error: "Le frais de versement n’a pas pu être lu. Il n’est pas remplacé par 0.",
  },
  escrow_not_held: {
    status: 409,
    error: "Libération refusée : le séquestre doit être held et le paiement paid.",
  },
  already_confirmed: {
    status: 409,
    error: "Réception déjà confirmée.",
  },
  escrow_conflict: {
    status: 409,
    error: "La commande a changé pendant la libération. Aucune écriture n’a été gardée.",
  },
}

/** 503 si la fonction manque ou échoue. 409 pour un refus métier. Jamais d'écriture commande. */
export function releaseLedgerHttp(result: ReleaseAttempt): {
  status: number
  mutateOrder: boolean
  body: { error: string; code: string } | null
} {
  if (result.ok) return { status: 200, mutateOrder: true, body: null }
  const mapped = RELEASE_HTTP[result.code] || RELEASE_HTTP.ledger_failed
  return {
    status: mapped.status,
    mutateOrder: false,
    body: { error: mapped.error, code: result.code },
  }
}
