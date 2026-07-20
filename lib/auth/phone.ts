/**
 * Validation et formatage téléphone — Afrique de l'Ouest / UEMOA
 *
 * Côte d'Ivoire (depuis 2021) : 10 chiffres NSN, PAS de trunk 0 à retirer.
 * Ex: 0788326019 → +2250788326019
 */

export const COUNTRY_DIAL_CODES: Record<
  string,
  { dial: string; label: string; nationalLength?: number; keepLeadingZero?: boolean }
> = {
  ci: { dial: "+225", label: "Côte d'Ivoire", nationalLength: 10, keepLeadingZero: true },
  sn: { dial: "+221", label: "Sénégal", nationalLength: 9 },
  ml: { dial: "+223", label: "Mali", nationalLength: 8 },
  bf: { dial: "+226", label: "Burkina Faso", nationalLength: 8 },
  bj: { dial: "+229", label: "Bénin", nationalLength: 10, keepLeadingZero: true },
  tg: { dial: "+228", label: "Togo", nationalLength: 8 },
  ne: { dial: "+227", label: "Niger", nationalLength: 8 },
  gn: { dial: "+224", label: "Guinée", nationalLength: 9 },
  gh: { dial: "+233", label: "Ghana", nationalLength: 9 },
  ng: { dial: "+234", label: "Nigeria", nationalLength: 10 },
  cm: { dial: "+237", label: "Cameroun", nationalLength: 9 },
  ma: { dial: "+212", label: "Maroc", nationalLength: 9 },
}

/** Préfixes mobiles CI (Orange 07, MTN 05, Moov 01, etc.) */
const CI_MOBILE_PREFIXES = /^(01|05|07|08|09|25|27)\d{8}$/

export function stripPhone(phone: string): string {
  return phone.replace(/[\s\-.()]/g, "")
}

/** Forme canonique pour comparaison DB (chiffres + + uniquement) */
export function normalizePhoneDigits(phone: string): string {
  return stripPhone(phone).replace(/[^\d+]/g, "")
}

export function validateCIPhone(phone: string): boolean {
  const cleaned = stripPhone(phone).replace(/^(\+225|00225)/, "")
  // Accepte avec ou sans 0 initial si déjà 10 chiffres
  if (CI_MOBILE_PREFIXES.test(cleaned)) return true
  if (/^(1|5|7|8|9|25|27)\d{8}$/.test(cleaned) && cleaned.length === 9) {
    // Ancien format erroné (0 manquant) — on refuse pour forcer le bon format
    return false
  }
  return false
}

export function validateWestAfricaPhone(
  phone: string,
  countryCode: string,
): boolean {
  if (countryCode === "ci") return validateCIPhone(phone)
  const country = COUNTRY_DIAL_CODES[countryCode]
  const digits = stripPhone(phone)
    .replace(/^\+\d{1,4}/, "")
    .replace(/^0+/, "")
  const len = country?.nationalLength
  if (len) return digits.length === len || digits.length === len - 1
  return digits.length >= 8 && digits.length <= 10 && /^\d+$/.test(digits)
}

export function formatPhoneE164(phone: string, countryCode = "ci"): string {
  const country = COUNTRY_DIAL_CODES[countryCode]
  if (!country) return ""

  let cleaned = stripPhone(phone)

  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`

  if (cleaned.startsWith("+")) {
    // Normaliser +225 0788… → +2250788…
    if (countryCode === "ci" && cleaned.startsWith("+225")) {
      const rest = cleaned.slice(4).replace(/\D/g, "")
      if (rest.length === 10) return `+225${rest}`
      if (rest.length === 9 && /^(1|5|7|8|9)/.test(rest)) {
        return `+2250${rest}`
      }
    }
    return cleaned
  }

  const dialDigits = country.dial.replace("+", "")
  if (cleaned.startsWith(dialDigits)) {
    cleaned = cleaned.slice(dialDigits.length)
  }

  // CI / BJ : conserver le 0 du préfixe opérateur (partie du NSN 10 chiffres)
  if (country.keepLeadingZero) {
    const national = cleaned.replace(/\D/g, "")
    if (national.length === 9 && /^(1|5|7|8|9)/.test(national)) {
      return `${country.dial}0${national}`
    }
    return `${country.dial}${national}`
  }

  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1)
  return `${country.dial}${cleaned.replace(/\D/g, "")}`
}

export function formatPhoneDisplay(e164: string): string {
  const n = normalizePhoneDigits(e164)
  if (n.startsWith("+225") && n.length === 14) {
    const local = n.slice(4)
    return `+225 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
  }
  return n
}

export function maskPhone(e164: string): string {
  const n = normalizePhoneDigits(e164)
  if (n.length < 8) return n
  return `${n.slice(0, 6)}•• •• ${n.slice(-2)}`
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!user || !domain) return email
  const visible = user.slice(0, Math.min(2, user.length))
  return `${visible}•••@${domain}`
}

/** Variantes possibles en base (espaces, 0 manquant, etc.) */
export function phoneLookupVariants(e164: string): string[] {
  const n = normalizePhoneDigits(e164)
  const variants = new Set<string>([n, e164, formatPhoneDisplay(n)])
  if (n.startsWith("+225") && n.length === 14) {
    const local = n.slice(4)
    variants.add(`+225 ${local}`)
    variants.add(local)
    variants.add(`0${local.slice(1)}`)
  }
  return [...variants]
}
