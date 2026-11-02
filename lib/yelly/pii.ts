/**
 * Réduit les fuites PII avant envoi à l’IA (téléphone, email, carte, OTP).
 * Ne remplace pas le jugement humain — filtre de surface.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** Cartes : 13–19 chiffres avec espaces/tirets typiques PAN */
const CARD_RE = /\b(?:\d{4}[ -]){3}\d{1,4}\b/g
const OTP_RE = /\b(?:code|otp|pin)\s*[:#-]?\s*\d{4,8}\b/gi
const PHONE_RE =
  /(?:\+|00)\d{1,3}[\s.-]?(?:\d{2}[\s.-]?){3,5}\d{2,4}|\b0\d(?:[\s.-]?\d{2}){4}\b/g

export function redactPiiForAi(input: string, max = 800): string {
  let out = (input || "").slice(0, max * 2)
  out = out.replace(EMAIL_RE, "[email masqué]")
  out = out.replace(OTP_RE, "[code masqué]")
  out = out.replace(PHONE_RE, "[téléphone masqué]")
  out = out.replace(CARD_RE, "[carte masquée]")
  return out.slice(0, max).trim()
}
