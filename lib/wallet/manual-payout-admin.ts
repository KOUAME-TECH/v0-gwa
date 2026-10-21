export const MANUAL_PAYOUT_TRANSITIONS = {
  pending: ["processing", "failed"],
  processing: ["paid", "failed"],
} as const

export type ManualPayoutStatus = keyof typeof MANUAL_PAYOUT_TRANSITIONS | "paid" | "failed"

type ManualPayoutUpdateValidation =
  | { ok: true }
  | { ok: false; code: "INVALID_STATUS" | "INVALID_TRANSITION" | "REFERENCE_REQUIRED" }

export function validateManualPayoutUpdate(
  currentStatus: string,
  nextStatus: string,
  payoutReference: string,
): ManualPayoutUpdateValidation {
  if (!["processing", "paid", "failed"].includes(nextStatus)) {
    return { ok: false, code: "INVALID_STATUS" }
  }
  if (!Object.prototype.hasOwnProperty.call(MANUAL_PAYOUT_TRANSITIONS, currentStatus)) {
    return { ok: false, code: "INVALID_TRANSITION" }
  }
  const allowedTransitions = MANUAL_PAYOUT_TRANSITIONS[
    currentStatus as keyof typeof MANUAL_PAYOUT_TRANSITIONS
  ]
  if (!allowedTransitions.includes(nextStatus as never)) {
    return { ok: false, code: "INVALID_TRANSITION" }
  }
  if (nextStatus === "paid" && (!payoutReference || payoutReference.length > 128)) {
    return { ok: false, code: "REFERENCE_REQUIRED" }
  }
  return { ok: true }
}
