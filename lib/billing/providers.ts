import type { PaymentProviderStrategy, ProviderRateCard } from "@/lib/billing/types"

/** Le moteur ne connaît que cette carte. La ligne SQL ou un test la fournit. */
export function providerStrategy(card: ProviderRateCard): PaymentProviderStrategy {
  return {
    provider: card.provider,
    rates() {
      return card
    },
  }
}
