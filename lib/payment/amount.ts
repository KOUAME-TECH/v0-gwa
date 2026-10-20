export function isExactPaymentAmount(
  paidValue: unknown,
  expectedValue: unknown,
): boolean {
  if (
    (typeof paidValue !== "number" && typeof paidValue !== "string") ||
    (typeof paidValue === "string" && !paidValue.trim())
  ) {
    return false
  }

  const paidAmount = Number(paidValue)
  const expectedAmount = Number(expectedValue)
  return (
    Number.isSafeInteger(paidAmount) &&
    Number.isFinite(expectedAmount) &&
    expectedAmount > 0 &&
    paidAmount === Math.round(expectedAmount)
  )
}
