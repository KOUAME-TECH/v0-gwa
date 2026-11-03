export function formatFcfa(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount))
}

export function BuyerPriceBreakdown({
  productPrice,
  serviceFee,
}: {
  productPrice: number
  serviceFee: number
}) {
  const total = productPrice + serviceFee
  return (
    <div className="space-y-2 rounded-2xl border border-[#1F5C2E]/10 bg-white p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-[#6B7280]">Prix du produit</span>
        <span>{formatFcfa(productPrice)} FCFA</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#6B7280]">Frais de service</span>
        <span>{formatFcfa(serviceFee)} FCFA</span>
      </div>
      <div className="flex justify-between border-t border-[#E5E7EB] pt-2 text-base font-bold">
        <span>Total à payer</span>
        <span className="text-[#1F5C2E]">{formatFcfa(total)} FCFA</span>
      </div>
      <p className="text-xs leading-relaxed text-[#6B7280]">
        Les frais de service couvrent la sécurisation du paiement et l&apos;assistance GWA.
      </p>
    </div>
  )
}
