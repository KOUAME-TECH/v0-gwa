// GWA Platform — Calcul des commissions GWA
// Grille tarifaire officielle (specs F3.3)

export type CommissionTier =
  | 'premiere_vente'         // 0% — offre bienvenue
  | 'cooperative_verifiee'   // 4% — coopérative avec RCCM vérifié
  | 'producteur_standard'    // 5% — producteur individuel standard
  | 'acheteur_b2b'           // 6% — acheteur B2B entreprise
  | 'premium'                // 8% — transactions premium / hors CI

interface CommissionInput {
  seller_id: string
  seller_sub_type: 'producteur_individuel' | 'cooperative'
  rccm_verified: boolean
  is_first_sale: boolean
  buyer_type?: string  // 'entreprise' | 'acheteur' | etc.
  country?: string
}

interface CommissionResult {
  tier: CommissionTier
  rate_pct: number
  commission_fcfa: number
  vendeur_recoit_fcfa: number
  label: string
}

const COMMISSION_RATES: Record<CommissionTier, number> = {
  premiere_vente:       0,
  cooperative_verifiee: 4,
  producteur_standard:  5,
  acheteur_b2b:         6,
  premium:              8,
}

const COMMISSION_LABELS: Record<CommissionTier, string> = {
  premiere_vente:       'Offre bienvenue — première vente gratuite',
  cooperative_verifiee: 'Tarif Coopérative GWA',
  producteur_standard:  'Commission standard producteur',
  acheteur_b2b:         'Commission B2B entreprise',
  premium:              'Commission premium',
}

/**
 * Calcule la commission GWA pour une transaction.
 * @param montant_fcfa - Montant brut de la transaction en FCFA
 * @param input - Informations sur le vendeur et la transaction
 */
export function calculateCommission(
  montant_fcfa: number,
  input: CommissionInput
): CommissionResult {
  let tier: CommissionTier

  if (input.is_first_sale) {
    tier = 'premiere_vente'
  } else if (
    input.seller_sub_type === 'cooperative' &&
    input.rccm_verified
  ) {
    tier = 'cooperative_verifiee'
  } else if (input.country && input.country !== 'CI') {
    tier = 'premium'
  } else if (input.buyer_type === 'entreprise') {
    tier = 'acheteur_b2b'
  } else {
    tier = 'producteur_standard'
  }

  const rate_pct = COMMISSION_RATES[tier]
  const commission_fcfa = Math.round(montant_fcfa * rate_pct / 100)
  const vendeur_recoit_fcfa = montant_fcfa - commission_fcfa

  return {
    tier,
    rate_pct,
    commission_fcfa,
    vendeur_recoit_fcfa,
    label: COMMISSION_LABELS[tier],
  }
}

/**
 * Vérifie si c'est la première vente d'un vendeur (appel Supabase)
 * Utilisé côté serveur uniquement
 */
export async function isFirstSale(
  seller_id: string,
  supabaseClient: { from: Function }
): Promise<boolean> {
  const { count } = await supabaseClient
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', seller_id)
    .eq('escrow_status', 'released')

  return (count || 0) === 0
}

/**
 * Formate un montant en FCFA pour l'affichage
 */
export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'
}
