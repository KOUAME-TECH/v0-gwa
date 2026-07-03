// GWA Platform — Référentiel conditionnement + validation
// Logique de validation des spécifications produit par filière

export type Filiere =
  | 'manioc' | 'riz' | 'cacao' | 'cajou' | 'tomate'
  | 'oignon' | 'banane_plantain' | 'piment' | 'attieke' | 'autre'

export interface ReferentielFiliere {
  filiere: Filiere
  conditionnements: string[]
  humidite_max_pct: number | null
  calibres: string[]
  specifications_requises: string[]
  notes: string
  exige_gps: boolean  // EUDR : cacao et cajou exigent GPS parcelle
}

export interface ProductSpecifications {
  humidite_pct?: number
  calibre?: string
  lot_id?: string
  date_recolte?: string
  coordonnees_gps?: string
  [key: string]: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Référentiel local (miroir des données en base pour validation côté client)
export const REFERENTIEL: Record<Filiere, ReferentielFiliere> = {
  manioc: {
    filiere: 'manioc',
    conditionnements: ['sac_50kg', 'vrac_tonne', 'colis_25kg'],
    humidite_max_pct: 14.0,
    calibres: ['grade_A', 'grade_B', 'tout_venant'],
    specifications_requises: ['humidite_pct', 'calibre', 'date_recolte', 'lot_id'],
    notes: 'Référentiel OCPV Côte d\'Ivoire',
    exige_gps: false,
  },
  riz: {
    filiere: 'riz',
    conditionnements: ['sac_50kg', 'sac_25kg', 'vrac_tonne'],
    humidite_max_pct: 14.0,
    calibres: ['grade_1', 'grade_2', 'brise'],
    specifications_requises: ['humidite_pct', 'calibre', 'date_recolte', 'lot_id'],
    notes: 'Normes OCPV + FAO pour riz paddy et riz blanchi',
    exige_gps: false,
  },
  cacao: {
    filiere: 'cacao',
    conditionnements: ['sac_60kg', 'sac_jute_65kg'],
    humidite_max_pct: 7.5,
    calibres: ['grade_1', 'grade_2', 'hors_grade'],
    specifications_requises: ['humidite_pct', 'calibre', 'lot_id', 'date_recolte', 'coordonnees_gps'],
    notes: 'EUDR obligatoire — GPS parcelle requis. Norme ICCO/CCC',
    exige_gps: true,
  },
  cajou: {
    filiere: 'cajou',
    conditionnements: ['sac_80kg', 'vrac_tonne', 'sac_50kg'],
    humidite_max_pct: 9.0,
    calibres: ['grade_W180', 'grade_W240', 'grade_W320', 'grade_W450', 'tout_venant'],
    specifications_requises: ['humidite_pct', 'calibre', 'lot_id', 'date_recolte'],
    notes: 'Normes CCA — Conseil du Cajou',
    exige_gps: false,
  },
  tomate: {
    filiere: 'tomate',
    conditionnements: ['colis_15kg', 'colis_10kg', 'caisse_plastique'],
    humidite_max_pct: null,
    calibres: ['calibre_57_67', 'calibre_47_57', 'tout_venant'],
    specifications_requises: ['calibre', 'date_recolte', 'lot_id'],
    notes: 'Tomate fraîche — calibres CEE',
    exige_gps: false,
  },
  oignon: {
    filiere: 'oignon',
    conditionnements: ['sac_50kg', 'filet_25kg', 'colis_20kg'],
    humidite_max_pct: null,
    calibres: ['calibre_S', 'calibre_M', 'calibre_L'],
    specifications_requises: ['calibre', 'date_recolte', 'lot_id'],
    notes: 'Oignon bulbe',
    exige_gps: false,
  },
  banane_plantain: {
    filiere: 'banane_plantain',
    conditionnements: ['regime', 'colis_20kg', 'carton_18kg'],
    humidite_max_pct: null,
    calibres: ['extra', 'cat_1', 'cat_2'],
    specifications_requises: ['calibre', 'date_recolte', 'lot_id'],
    notes: 'Banane plantain fraîche',
    exige_gps: false,
  },
  piment: {
    filiere: 'piment',
    conditionnements: ['sac_10kg', 'colis_5kg', 'vrac'],
    humidite_max_pct: null,
    calibres: ['frais', 'seche', 'poudre'],
    specifications_requises: ['calibre', 'date_recolte', 'lot_id'],
    notes: 'Piment frais ou séché',
    exige_gps: false,
  },
  attieke: {
    filiere: 'attieke',
    conditionnements: ['sac_50kg', 'emballage_5kg', 'emballage_1kg'],
    humidite_max_pct: 13.0,
    calibres: ['premium', 'standard'],
    specifications_requises: ['humidite_pct', 'date_fabrication', 'lot_id'],
    notes: 'Attiéké — semoule de manioc fermentée',
    exige_gps: false,
  },
  autre: {
    filiere: 'autre',
    conditionnements: ['sac_50kg', 'vrac', 'colis'],
    humidite_max_pct: null,
    calibres: ['grade_A', 'grade_B', 'tout_venant'],
    specifications_requises: ['lot_id', 'date_recolte'],
    notes: 'Filière générique',
    exige_gps: false,
  },
}

/**
 * Valide les spécifications d'un produit selon le référentiel de sa filière
 */
export function validateProductSpecifications(
  filiere: Filiere,
  conditionnement: string | undefined,
  specs: ProductSpecifications
): ValidationResult {
  const ref = REFERENTIEL[filiere]
  const errors: string[] = []
  const warnings: string[] = []

  // Vérifier le conditionnement
  if (conditionnement && !ref.conditionnements.includes(conditionnement)) {
    errors.push(
      `Conditionnement "${conditionnement}" non accepté pour ${filiere}. ` +
      `Acceptés : ${ref.conditionnements.join(', ')}`
    )
  }

  // Vérifier l'humidité max
  if (ref.humidite_max_pct !== null && specs.humidite_pct !== undefined) {
    if (specs.humidite_pct > ref.humidite_max_pct) {
      errors.push(
        `Humidité ${specs.humidite_pct}% dépasse le maximum autorisé ` +
        `(${ref.humidite_max_pct}% pour ${filiere})`
      )
    }
  }

  // Vérifier le calibre
  if (specs.calibre && ref.calibres.length > 0 && !ref.calibres.includes(specs.calibre)) {
    warnings.push(
      `Calibre "${specs.calibre}" inhabituel pour ${filiere}. ` +
      `Calibres standards : ${ref.calibres.join(', ')}`
    )
  }

  // Vérifier les specs requises
  for (const required of ref.specifications_requises) {
    if (required === 'coordonnees_gps') continue // géré séparément
    if (!specs[required] && specs[required] !== 0) {
      warnings.push(`Spécification recommandée manquante : ${required}`)
    }
  }

  // EUDR : GPS obligatoire pour cacao
  if (ref.exige_gps && !specs.coordonnees_gps) {
    errors.push(
      `GPS de la parcelle obligatoire pour ${filiere} (conformité EUDR). ` +
      `Ajoutez les coordonnées GPS de votre exploitation.`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Génère un lot ID automatique
 */
export function generateLotId(userId: string, filiere: Filiere): string {
  const date = new Date().toISOString().slice(0, 7).replace('-', '') // YYYYMM
  const userSuffix = userId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const filiereCode = filiere.slice(0, 3).toUpperCase()
  return `LOT-${date}-${filiereCode}-${userSuffix}`
}

export const FILIERE_LABELS: Record<Filiere, string> = {
  manioc:          'Manioc',
  riz:             'Riz',
  cacao:           'Cacao',
  cajou:           'Cajou (noix de cajou)',
  tomate:          'Tomate',
  oignon:          'Oignon',
  banane_plantain: 'Banane plantain',
  piment:          'Piment',
  attieke:         'Attiéké',
  autre:           'Autre',
}
