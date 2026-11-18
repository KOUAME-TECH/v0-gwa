export type PaymentProvider = "GENIUSPAY" | "PAWAPAY" | "MOOV_API" | "MOCK"

export type PricingTarget = "producer" | "cooperative"

/** Frais de service acheteur validé. Le moteur le reçoit, il ne le cherche pas en dur dans un prestataire. */
export const BUYER_SERVICE_FEE_FCFA = 250

export type BillingContext = {
  productPrice: number
  paymentProvider: PaymentProvider
  /** Taux du pay-in, lu dans payment_providers_config.payin_rate. */
  providerPayinRate: number
  /** Coût fixe d'un virement, lu dans payment_providers_config.payout_fixed_fee. */
  providerPayoutFixedFee: number
  /** false aujourd'hui (GeniusPay manuel). true à partir de mars 2027. */
  automationEnabled: boolean
  commissionRate: number
  franchiseThreshold: number
  franchiseCap: number
  franchiseSurplusRate?: number
  target: PricingTarget
  payoutIncluded: number
  payoutsAlreadyThisMonth: number
  buyerServiceFee?: number
}

export type BillingBreakdown = {
  paymentProvider: PaymentProvider
  productPrice: number
  buyerServiceFee: number
  buyerTotal: number
  providerPayinFee: number
  commission: number
  franchiseApplied: boolean
  providerPayoutFee: number
  payoutPaidBySeller: number
  payoutAbsorbedByGwa: number
  sellerNet: number
  gwaNetMargin: number
}

export type ProviderRateCard = {
  provider: PaymentProvider
  payinRate: number
  payoutFixedFee: number
  automationEnabled: boolean
}

export interface PaymentProviderStrategy {
  readonly provider: PaymentProvider
  rates(): ProviderRateCard
}
