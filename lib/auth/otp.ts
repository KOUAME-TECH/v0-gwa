/**
 * GWA — F1 Auth OTP
 * Validation téléphone CI + helpers OTP Supabase
 */

// ─── Validation numéro de téléphone Côte d'Ivoire ───────────────────────────
// Formats acceptés : 07 12 34 56 78  |  +225 07 12 34 56 78  |  00225 07...
// Préfixes valides CI : 01, 05, 07, 08, 09, 25, 27
export function validateCIPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\.]/g, "").replace(/^(\+225|00225)/, "")
  return /^(01|05|07|08|09|25|27)\d{8}$/.test(cleaned)
}

export function normalizeCIPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\.]/g, "").replace(/^(\+225|00225)/, "")
  return `+225${cleaned}`
}

export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[\s\-\.]/g, "").replace(/^(\+225|00225)/, "")
  // Format: 07 12 34 56 78
  return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5")
}

// ─── Types profil ─────────────────────────────────────────────────────────────
export type SubType = "producteur_individuel" | "cooperative"

export type UserRole = "user" | "admin" | "support"

export interface OnboardingData {
  sub_type: SubType
  // Producteur individuel
  full_name?: string
  city?: string
  surface_ha?: number
  filieres?: string[]
  mode_culture?: "traditionnel" | "semi-intensif" | "intensif"
  certif_bio?: boolean
  certif_fairtrade?: boolean
  annee_debut_activite?: number
  coordonnees_gps?: string
  // Coopérative
  rccm_numero?: string
  nb_membres?: number
  nb_hectares_total?: number
  president_name?: string
  secretary_name?: string
  commercial_contact?: string
  coop_type?: "GIE" | "SCOOP" | "SA" | "SARL" | "association"
  zones_production?: string[]
  capacite_stockage_tonnes?: number
  a_vehicule_transport?: boolean
}

// ─── Calcul completion profil (miroir du trigger SQL) ────────────────────────
export function calcProfileCompletion(profile: Record<string, unknown>): number {
  let pct = 0

  // Champs communs (50 pts)
  if (profile.full_name) pct += 10
  if (profile.phone) pct += 10
  if (profile.city) pct += 5
  if (profile.avatar_url) pct += 10
  if (profile.bio && String(profile.bio).length > 20) pct += 5
  if (profile.sub_type) pct += 10

  if (profile.sub_type === "producteur_individuel") {
    if (profile.surface_ha) pct += 15
    if (Array.isArray(profile.filieres) && profile.filieres.length > 0) pct += 20
    if (profile.coordonnees_gps) pct += 15
  } else if (profile.sub_type === "cooperative") {
    if (profile.president_name) pct += 10
    if (profile.nb_membres) pct += 10
    if (profile.rccm_numero) pct += 15
    if (Array.isArray(profile.zones_production) && profile.zones_production.length > 0) pct += 15
  }

  return Math.min(pct, 100)
}

// ─── Constantes filières CI ───────────────────────────────────────────────────
export const FILIERES_CI = [
  { value: "manioc", label: "Manioc" },
  { value: "riz", label: "Riz" },
  { value: "cacao", label: "Cacao" },
  { value: "cajou", label: "Cajou (noix de cajou)" },
  { value: "tomate", label: "Tomate" },
  { value: "oignon", label: "Oignon" },
  { value: "banane_plantain", label: "Banane plantain" },
  { value: "piment", label: "Piment" },
  { value: "attieke", label: "Attiéké" },
  { value: "autre", label: "Autre" },
] as const

export const REGIONS_CI = [
  "Abidjan", "Aboisso", "Adzopé", "Agboville", "Agnibilékrou",
  "Bondoukou", "Bouaké", "Daloa", "Divo", "Gagnoa",
  "Grand-Bassam", "Korhogo", "Man", "San-Pédro", "Yamoussoukro",
  "Soubré", "Bouaflé", "Dimbokro", "Katiola", "Séguéla",
] as const

export const ZONES_CI = REGIONS_CI

// ─── Rate limit OTP en mémoire (backup middleware) ───────────────────────────
const OTP_ATTEMPTS = new Map<string, { count: number; resetAt: number }>()

export function checkOtpRateLimit(phone: string): { allowed: boolean; waitSeconds: number } {
  const key = `otp:${phone}`
  const now = Date.now()
  const entry = OTP_ATTEMPTS.get(key)

  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      return { allowed: false, waitSeconds: Math.ceil((entry.resetAt - now) / 1000) }
    }
    entry.count++
  } else {
    OTP_ATTEMPTS.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }) // 15 min
  }

  return { allowed: true, waitSeconds: 0 }
}
