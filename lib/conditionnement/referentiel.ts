/**
 * GWA — F2 Référentiel conditionnement par filière CI
 * Règles métier Phase 0 — validation serveur et client
 */

export interface ConditionnementReferentiel {
  filiere: string
  humidite_max_pct: number
  calibres: string[]
  conditionnements_acceptes: string[]
  eudr_requis: boolean // GPS obligatoire si true (cacao, café)
  unite_defaut: string
}

export interface ConditionnementInput {
  filiere: string
  humidite_pct?: number
  calibre?: string
  conditionnement?: string
  lot_id?: string
  date_recolte?: string
  coordonnees_gps?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ─── Référentiel complet filières CI ─────────────────────────────────────────
export const REFERENTIEL: Record<string, ConditionnementReferentiel> = {
  cacao: {
    filiere: "cacao",
    humidite_max_pct: 7.5,
    calibres: ["grade_A", "grade_B", "grade_C"],
    conditionnements_acceptes: ["sac_60kg", "sac_65kg", "vrac_tonne"],
    eudr_requis: true,
    unite_defaut: "kg",
  },
  cajou: {
    filiere: "cajou",
    humidite_max_pct: 9.0,
    calibres: ["W180", "W210", "W240", "W320", "W450", "brut"],
    conditionnements_acceptes: ["sac_50kg", "sac_80kg", "vrac_tonne"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  riz: {
    filiere: "riz",
    humidite_max_pct: 14.0,
    calibres: ["entier", "brisure_25", "brisure_50", "brisure_100"],
    conditionnements_acceptes: ["sac_25kg", "sac_50kg", "vrac_tonne"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  manioc: {
    filiere: "manioc",
    humidite_max_pct: 15.0,
    calibres: ["frais", "seche", "farine", "attieke"],
    conditionnements_acceptes: ["sac_50kg", "sac_100kg", "bache", "vrac_tonne"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  tomate: {
    filiere: "tomate",
    humidite_max_pct: 95.0,
    calibres: ["calibre_1", "calibre_2", "calibre_3"],
    conditionnements_acceptes: ["caisse_10kg", "caisse_20kg", "filet"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  oignon: {
    filiere: "oignon",
    humidite_max_pct: 80.0,
    calibres: ["petit", "moyen", "gros"],
    conditionnements_acceptes: ["sac_25kg", "sac_50kg", "filet"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  banane_plantain: {
    filiere: "banane_plantain",
    humidite_max_pct: 75.0,
    calibres: ["long", "court", "moyen"],
    conditionnements_acceptes: ["regime", "caisse_15kg", "caisse_20kg"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  piment: {
    filiere: "piment",
    humidite_max_pct: 85.0,
    calibres: ["frais", "seche", "poudre"],
    conditionnements_acceptes: ["sac_10kg", "sac_25kg", "caisse"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  attieke: {
    filiere: "attieke",
    humidite_max_pct: 50.0,
    calibres: ["fin", "gros", "standard"],
    conditionnements_acceptes: ["sac_5kg", "sac_10kg", "sac_25kg"],
    eudr_requis: false,
    unite_defaut: "kg",
  },
  autre: {
    filiere: "autre",
    humidite_max_pct: 100.0,
    calibres: [],
    conditionnements_acceptes: [],
    eudr_requis: false,
    unite_defaut: "kg",
  },
}

// ─── Validation conditionnement ───────────────────────────────────────────────
export function validateConditionnement(input: ConditionnementInput): ValidationResult {
  const errors: string[] = []
  const ref = REFERENTIEL[input.filiere]

  if (!ref) {
    return { valid: false, errors: [`Filière inconnue : ${input.filiere}`] }
  }

  // Humidité
  if (input.humidite_pct !== undefined && input.humidite_pct > ref.humidite_max_pct) {
    errors.push(
      `Humidité ${input.humidite_pct}% dépasse le max autorisé (${ref.humidite_max_pct}% pour ${input.filiere})`
    )
  }

  // Calibre
  if (input.calibre && ref.calibres.length > 0 && !ref.calibres.includes(input.calibre)) {
    errors.push(
      `Calibre "${input.calibre}" non accepté. Options : ${ref.calibres.join(", ")}`
    )
  }

  // Conditionnement
  if (
    input.conditionnement &&
    ref.conditionnements_acceptes.length > 0 &&
    !ref.conditionnements_acceptes.includes(input.conditionnement)
  ) {
    errors.push(
      `Conditionnement "${input.conditionnement}" non accepté. Options : ${ref.conditionnements_acceptes.join(", ")}`
    )
  }

  // EUDR : GPS obligatoire pour cacao/café
  if (ref.eudr_requis && !input.coordonnees_gps) {
    errors.push(
      `Filière ${input.filiere} : coordonnées GPS de la parcelle obligatoires (conformité EUDR)`
    )
  }

  return { valid: errors.length === 0, errors }
}

// ─── Générer un lot_id automatique ───────────────────────────────────────────
export function generateLotId(userId: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const suffix = userId.slice(0, 4).toUpperCase()
  return `LOT-${date}-${suffix}`
}
