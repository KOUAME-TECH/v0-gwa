import { payoutFeeFcfa } from "@/lib/features/payments/payout-fee"
import { quotePricing, roundFcfa } from "@/lib/pricing/quote"
import {
  BUYER_SERVICE_FEE_FCFA,
  type BillingBreakdown,
  type BillingContext,
  type PaymentProviderStrategy,
} from "@/lib/billing/types"

export type SellerBillingInput = Omit<
  BillingContext,
  "paymentProvider" | "providerPayinRate" | "providerPayoutFixedFee" | "automationEnabled"
>

/** Copie les taux du fournisseur dans le contexte. Aucun fichier de config n'est lu ici. */
export function withProvider(input: SellerBillingInput, strategy: PaymentProviderStrategy): BillingContext {
  const rates = strategy.rates()
  return {
    ...input,
    paymentProvider: strategy.provider,
    providerPayinRate: rates.payinRate,
    providerPayoutFixedFee: rates.payoutFixedFee,
    automationEnabled: rates.automationEnabled,
  }
}

/**
 * Total acheteur = prix + frais de service.
 * Frais de pay-in = total acheteur × taux du fournisseur.
 * Si l'automatisation est active, GWA absorbe le virement. Sinon, le plan vendeur décide.
 * Marge nette = (commission + frais acheteur) − pay-in − virement absorbé.
 */
export function calculateBilling(context: BillingContext): BillingBreakdown {
  const price = roundFcfa(Math.max(0, context.productPrice))
  const buyerServiceFee = roundFcfa(
    context.buyerServiceFee == null ? BUYER_SERVICE_FEE_FCFA : Math.max(0, context.buyerServiceFee),
  )
  const buyerTotal = price + buyerServiceFee
  const providerPayinFee = roundFcfa(buyerTotal * Math.max(0, context.providerPayinRate))

  const quote = quotePricing(
    {
      name: "CONTEXT",
      target: context.target,
      monthly_fee: 0,
      commission_rate: context.commissionRate,
      buyer_service_fee_fixed: 0,
      buyer_service_fee_rate: 0,
      franchise_threshold: context.franchiseThreshold,
      franchise_cap: context.franchiseCap,
      payout_included: context.payoutIncluded,
      switch_threshold: null,
    },
    price,
    { franchiseSurplusRate: context.franchiseSurplusRate ?? 0 },
  )

  const providerPayoutFee = roundFcfa(Math.max(0, context.providerPayoutFixedFee))
  const sellerOwesPayout =
    !context.automationEnabled &&
    payoutFeeFcfa({
      payoutsAlreadyThisMonth: context.payoutsAlreadyThisMonth,
      payoutIncluded: context.payoutIncluded,
      feeCost: providerPayoutFee,
    }) > 0
  const payoutPaidBySeller = sellerOwesPayout ? providerPayoutFee : 0
  const payoutAbsorbedByGwa = context.automationEnabled ? providerPayoutFee : 0
  const sellerNet = Math.max(0, price - quote.seller_commission - payoutPaidBySeller)
  const gwaNetMargin = quote.seller_commission + buyerServiceFee - providerPayinFee - payoutAbsorbedByGwa

  return {
    paymentProvider: context.paymentProvider,
    productPrice: price,
    buyerServiceFee,
    buyerTotal,
    providerPayinFee,
    commission: quote.seller_commission,
    franchiseApplied: quote.franchise_applied,
    providerPayoutFee,
    payoutPaidBySeller,
    payoutAbsorbedByGwa,
    sellerNet,
    gwaNetMargin,
  }
}
