/** Messages d'achat actionnables. La règle anti auto-achat reste en place. */

export function selfPurchaseMessage(userType: string | null | undefined): string {
  if (userType === "producteur" || userType === "farmer" || userType === "cooperative") {
    return "Votre compte producteur ne permet pas d'acheter vos propres offres. Utilisez un compte acheteur."
  }
  return "Vous ne pouvez pas acheter une offre publiée par votre propre compte. Utilisez un compte acheteur distinct."
}

export function insufficientStockMessage(productName: string, available: number): string {
  const left = Math.max(0, Math.floor(available))
  if (left <= 0) return `${productName} n'est plus disponible. Retirez-le du panier.`
  return `Il reste ${left} pour « ${productName} ». Réduisez la quantité.`
}
