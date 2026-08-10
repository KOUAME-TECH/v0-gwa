/**
 * GWA — F3 Calcul commissions
 * Règles métier Phase 0
 *
 * Grille :
 *   0%  — première vente du vendeur (offre bienvenue)
 *   4%  — coopérative avec RCCM vérifié
 *   5%  — coopérative sans RCCM
 *   6%  — producteur individuel (taux standard)
 *   8%  — producteur individuel < 3 transactions (profil incomplet)
 */

export interface CommissionInput {
  montant_fcfa: number
  seller_sub_type: "producteur_individuel" | "cooperative"
  seller_rccm_verified: boolean
  seller_total_orders: number       // nombre de commandes livrées jusqu'ici
  seller_profile_completion: number // 0-100
}

export interface CommissionResult {
  taux_pct: number
  commission_fcfa: number
  vendeur_recoit_fcfa: number
  label: string
}

export function calculateCommission(input: CommissionInput): CommissionResult {
  const {
    montant_fcfa,
    seller_sub_type,
    seller_rccm_verified,
    seller_total_orders,
    seller_profile_completion,
  } = input

  let taux_pct: number
  let label: string

  // Règle 1 : première vente → gratuit
  if (seller_total_orders === 0) {
    taux_pct = 0
    label = "Offre bienvenue — première vente gratuite"
  }
  // Règle 2 : coopérative RCCM vérifié → 4%
  else if (seller_sub_type === "cooperative" && seller_rccm_verified) {
    taux_pct = 4
    label = "Tarif Coopérative GWA (RCCM vérifié)"
  }
  // Règle 3 : coopérative sans RCCM → 5%
  else if (seller_sub_type === "cooperative" && !seller_rccm_verified) {
    taux_pct = 5
    label = "Tarif Coopérative GWA"
  }
  // Règle 4 : producteur débutant (< 3 ventes OU profil < 50%) → 8%
  else if (seller_total_orders < 3 || seller_profile_completion < 50) {
    taux_pct = 8
    label = "Tarif débutant — complétez votre profil pour bénéficier du tarif standard"
  }
  // Règle 5 : producteur standard → 6%
  else {
    taux_pct = 6
    label = "Tarif standard producteur GWA"
  }

  const commission_fcfa = Math.round(montant_fcfa * taux_pct / 100)
  const vendeur_recoit_fcfa = montant_fcfa - commission_fcfa

  return { taux_pct, commission_fcfa, vendeur_recoit_fcfa, label }
}

/** Formater un montant FCFA pour affichage */
export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}
