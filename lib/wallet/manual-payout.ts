export const MANUAL_PAYOUT_NETWORKS = [
  "orange_ci",
  "mtn_ci",
  "moov_ci",
  "wave_ci",
] as const

export type ManualPayoutNetwork = (typeof MANUAL_PAYOUT_NETWORKS)[number]

type ManualPayoutInput = {
  amount: number
  phone: string
  network: string
  available: number
}

type ManualPayoutValidation =
  | { ok: true; amount: number; phone: string; network: ManualPayoutNetwork }
  | { ok: false; code: "INVALID_AMOUNT" | "INSUFFICIENT_BALANCE" | "INVALID_PHONE" | "INVALID_NETWORK" }

export function validateManualPayoutRequest(
  input: ManualPayoutInput,
): ManualPayoutValidation {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1000) {
    return { ok: false, code: "INVALID_AMOUNT" }
  }
  if (input.amount > input.available) {
    return { ok: false, code: "INSUFFICIENT_BALANCE" }
  }
  const phone = input.phone.trim()
  if (!/^[+\d][\d\s().-]{7,24}$/.test(phone)) {
    return { ok: false, code: "INVALID_PHONE" }
  }
  if (!MANUAL_PAYOUT_NETWORKS.includes(input.network as ManualPayoutNetwork)) {
    return { ok: false, code: "INVALID_NETWORK" }
  }
  return {
    ok: true,
    amount: input.amount,
    phone,
    network: input.network as ManualPayoutNetwork,
  }
}
