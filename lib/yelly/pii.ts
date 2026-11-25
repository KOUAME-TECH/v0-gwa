/**
 * Réduit les fuites PII avant envoi à l’IA : e-mail, téléphone, adresse
 * (rue, boîte postale, coordonnées GPS), carte bancaire, code OTP.
 * Filtre de surface : il ne remplace pas le jugement humain.
 * Les villes et régions sont conservées (contexte utile, pas une adresse).
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** Cartes : 13–19 chiffres avec espaces/tirets typiques PAN */
const CARD_RE = /\b(?:\d{4}[ -]){3}\d{1,4}\b/g
const OTP_RE = /\b(?:code|otp|pin)\s*[:#-]?\s*\d{4,8}\b/gi
const PHONE_RE =
  /(?:\+|00)\d{1,3}[\s.-]?(?:\d{2}[\s.-]?){3,5}\d{2,4}|\b0\d(?:[\s.-]?\d{2}){4}\b/g
/** Coordonnées GPS décimales « 5.3364, -4.0267 » */
const GPS_RE = /-?\b\d{1,2}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}\b/g
/** Boîte postale ivoirienne « 01 BP 1234 », « BP 45 » */
const BP_RE = /\b(?:\d{2}\s+)?B\.?\s?P\.?\s*\d{1,6}\b/gi
/** Adresse de rue : « 12 rue des Jardins », « Rue 7 », « avenue Chardy », « ilot 3 » */
const STREET_RE =
  /\b(?:\d{1,4}\s*,?\s*)?(?:rue|avenue|av\.|boulevard|bd|impasse|allée|ilot|îlot|villa|immeuble)\s+[\wÀ-ÿ'’.-]+(?:\s+[\wÀ-ÿ'’.-]+){0,2}/gi

export function redactPiiForAi(input: string, max = 800): string {
  let out = (input || "").slice(0, max * 2)
  out = out.replace(EMAIL_RE, "[email masqué]")
  out = out.replace(OTP_RE, "[code masqué]")
  out = out.replace(GPS_RE, "[position masquée]")
  out = out.replace(PHONE_RE, "[téléphone masqué]")
  out = out.replace(CARD_RE, "[carte masquée]")
  out = out.replace(BP_RE, "[adresse masquée]")
  out = out.replace(STREET_RE, "[adresse masquée]")
  return out.slice(0, max).trim()
}

/** Vrai si le texte contient encore une PII détectable (garde-fou de test et de log). */
export function containsPii(input: string): boolean {
  const s = input || ""
  return [EMAIL_RE, PHONE_RE, GPS_RE, BP_RE, STREET_RE, CARD_RE].some((re) => {
    re.lastIndex = 0
    const hit = re.test(s)
    re.lastIndex = 0
    return hit
  })
}
