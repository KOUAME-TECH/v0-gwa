/**
 * Frais de versement. Le montant vient de platform_settings.
 * Le quota inclus vient du plan. Graine a 0 : chaque versement est facturé.
 */
export function payoutFeeFcfa(input: {
  payoutsAlreadyThisMonth: number
  payoutIncluded: number
  feeCost: number
}): number {
  const already = Math.max(0, Math.floor(Number(input.payoutsAlreadyThisMonth) || 0))
  const included = Math.max(0, Math.floor(Number(input.payoutIncluded) || 0))
  const fee = Math.max(0, Math.round(Number(input.feeCost) || 0))
  if (already >= included) return fee
  return 0
}

export function sellerReceivesAfterPayoutFee(sellerNet: number, fee: number): number {
  return Math.max(0, Math.round(sellerNet) - Math.max(0, Math.round(fee)))
}
