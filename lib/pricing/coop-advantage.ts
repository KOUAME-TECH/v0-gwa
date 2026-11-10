import { roundFcfa, seedPlan, type PricingPlanInput } from "@/lib/pricing/quote"

/** Part d'abonnement par membre actif. 8 000 F / 10 = 800 F. */
export function memberShareFcfa(monthlyFee: number, activeMembers: number): number {
  const fee = Math.max(0, Math.round(Number(monthlyFee) || 0))
  const members = Math.floor(Number(activeMembers) || 0)
  if (members <= 0) return fee
  return Math.round(fee / members)
}

export type SoloCoopComparison = {
  soloCommission: number
  soloFee: number
  soloTotal: number
  coopCommission: number
  memberShare: number
  coopTotal: number
  monthlyGain: number
}

/**
 * Compare un mois de ventes, pas une seule commande.
 * La franchise et les 2 % s'appliquent commande par commande, ailleurs.
 */
export function compareSoloToCoop(input: {
  monthlyRevenue: number
  solo: Pick<PricingPlanInput, "commission_rate" | "monthly_fee">
  coop: Pick<PricingPlanInput, "commission_rate" | "monthly_fee">
  activeMembers: number
}): SoloCoopComparison {
  const revenue = Math.max(0, roundFcfa(input.monthlyRevenue))
  const soloCommission = roundFcfa(revenue * (Number(input.solo.commission_rate) || 0))
  const coopCommission = roundFcfa(revenue * (Number(input.coop.commission_rate) || 0))
  const soloFee = Math.max(0, Math.round(input.solo.monthly_fee || 0))
  const memberShare = memberShareFcfa(input.coop.monthly_fee, input.activeMembers)
  const soloTotal = soloCommission + soloFee
  const coopTotal = coopCommission + memberShare
  return {
    soloCommission,
    soloFee,
    soloTotal,
    coopCommission,
    memberShare,
    coopTotal,
    monthlyGain: soloTotal - coopTotal,
  }
}

export function pousseVersusCoop(monthlyRevenue: number, activeMembers = 10): SoloCoopComparison {
  return compareSoloToCoop({
    monthlyRevenue,
    solo: seedPlan("STARTER"),
    coop: seedPlan("COOP_START"),
    activeMembers,
  })
}

export function rfqNeedsCoop(volumeRequested: number, soloAvailable: number): boolean {
  const asked = Math.floor(Number(volumeRequested) || 0)
  const available = Math.max(0, Math.floor(Number(soloAvailable) || 0))
  return asked > available
}
