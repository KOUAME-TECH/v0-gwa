/**
 * Réduit les fuites PII avant envoi à l’IA : e-mail, téléphone, IBAN,
 * adresse (rue, boîte postale, coordonnées GPS), carte bancaire, code OTP.
 * Filtre de surface : il ne remplace pas le jugement humain.
 * Les villes et régions sont conservées (contexte utile, pas une adresse).
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** Cartes : 13–19 chiffres avec espaces/tirets typiques PAN */
const CARD_RE = /\b(?:\d{4}[ -]){3}\d{1,4}\b/g
const OTP_RE = /\b(?:code|otp|pin)\s*[:#-]?\s*\d{4,8}\b/gi
/**
 * IBAN : 2 lettres pays + 2 chiffres de contrôle + 10 à 30 caractères
 * alphanumériques, en majuscules ou minuscules, collés ou séparés par des
 * espaces ou des tirets (« CI93 CI00 0001 … », « ci93-ci00-… », « FR76… »).
 * Un candidat n’est masqué que s’il contient au moins 10 chiffres, et les mots
 * purement alphabétiques avalés en fin de correspondance (« … 45 merci ») sont
 * rendus au texte (voir `redactIban`).
 */
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,30}\b/gi
/**
 * Téléphones :
 * - international `+225…` / `00225…` (ou autre indicatif) ;
 * - national à 10 chiffres `0X XX XX XX XX` ;
 * - `225` collé sans `+` ni `00`, suivi de 8 ou 10 chiffres (`2250788…`).
 * Les identifiants de type `GWA-1234…` sont exclus (pas de lettre ni de tiret juste avant).
 */
const PHONE_RE =
  /(?:\+|00)\d{1,3}[\s.-]?(?:\d{2}[\s.-]?){3,5}\d{2,4}|(?<![\w-])0\d(?:[\s.-]?\d{2}){4}(?![\w-])|(?<![\w-])225[\s.-]?(?:\d{2}[\s.-]?){3,4}\d{2}(?![\w-])/g
/**
 * Mobile money (Wave, Orange Money, MTN, Moov) saisi sans le 0 initial :
 * 9 chiffres commençant par 1, 5 ou 7.
 * Équilibre faux positifs / oublis :
 * - format groupé `7 XX XX XX XX` (séparateurs espace, point ou tiret) : toujours masqué ;
 * - 9 chiffres collés (`7XXXXXXXX`) : masqué seulement si un mot de contact
 *   précède dans les ~30 caractères (tel, téléphone, numéro, appelle, Wave, OM,
 *   Orange, MTN, Moov, WhatsApp, joindre, contact…). Un nombre nu (quantité,
 *   référence) reste intact.
 * Toujours exclus : montants (suivis de F, FCFA, XOF, kg…) et identifiants (`GWA-…`).
 */
const MOBILE9_RE =
  /(?<![\w-])[157](?:\d{8}|[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2})(?![\w-])(?!\s*(?:f\b|fcfa|cfa|xof|francs?|kg|tonnes?|t\b|sacs?|litres?|l\b))/gi
const PHONE_CONTEXT_RE =
  /(?:\b(?:t[ée]l|t[ée]l[ée]phone|portable|mobile|num[ée]ro|num|n°|appel+e?r?|appelle[zs]?|wave|om|orange|mtn|moov|whatsapp|wa|joindre|contact(?:e[rz]?)?|sms)\b|n°)[^\d]{0,30}$/i

function redactMobile9(text: string): string {
  return text.replace(MOBILE9_RE, (m: string, offset: number) => {
    if (!/^\d{9}$/.test(m)) return "[téléphone masqué]"
    const before = text.slice(Math.max(0, offset - 40), offset)
    return PHONE_CONTEXT_RE.test(before) ? "[téléphone masqué]" : m
  })
}

function hasMobile9(text: string): boolean {
  return redactMobile9(text) !== text
}
/** Coordonnées GPS décimales « 5.3364, -4.0267 » */
const GPS_RE = /-?\b\d{1,2}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}\b/g
/** Boîte postale ivoirienne « 01 BP 1234 », « BP 45 » */
const BP_RE = /\b(?:\d{2}\s+)?B\.?\s?P\.?\s*\d{1,6}\b/gi
/** Adresse de rue : « 12 rue des Jardins », « Rue 7 », « avenue Chardy », « ilot 3 » */
const STREET_RE =
  /\b(?:\d{1,4}\s*,?\s*)?(?:rue|avenue|av\.|boulevard|bd|impasse|allée|ilot|îlot|villa|immeuble)\s+[\wÀ-ÿ'’.-]+(?:\s+[\wÀ-ÿ'’.-]+){0,2}/gi

function looksLikeIban(candidate: string): boolean {
  return (candidate.match(/\d/g) || []).length >= 10
}

function redactIban(text: string): string {
  return text.replace(IBAN_RE, (m) => {
    // Rend au texte les mots purement alphabétiques avalés en fin de match.
    let tail = ""
    let core = m
    let t: RegExpMatchArray | null
    while ((t = core.match(/[ -][A-Za-z]+$/))) {
      tail = t[0] + tail
      core = core.slice(0, -t[0].length)
    }
    return looksLikeIban(core) ? `[IBAN masqué]${tail}` : m
  })
}

export function redactPiiForAi(input: string, max = 800): string {
  let out = (input || "").slice(0, max * 2)
  out = out.replace(EMAIL_RE, "[email masqué]")
  out = out.replace(OTP_RE, "[code masqué]")
  out = redactIban(out)
  out = out.replace(GPS_RE, "[position masquée]")
  out = out.replace(PHONE_RE, "[téléphone masqué]")
  out = redactMobile9(out)
  out = out.replace(CARD_RE, "[carte masquée]")
  out = out.replace(BP_RE, "[adresse masquée]")
  out = out.replace(STREET_RE, "[adresse masquée]")
  return out.slice(0, max).trim()
}

/**
 * Masque seulement les coordonnées (e-mail, téléphone, IBAN, carte), sans
 * tronquer : utilisé pour nettoyer les événements Sentry.
 */
export function maskContactPii(input: string): string {
  let out = input || ""
  out = out.replace(EMAIL_RE, "[email masqué]")
  out = redactIban(out)
  out = out.replace(PHONE_RE, "[téléphone masqué]")
  out = redactMobile9(out)
  out = out.replace(CARD_RE, "[carte masquée]")
  return out
}

function hits(re: RegExp, s: string): boolean {
  re.lastIndex = 0
  const hit = re.test(s)
  re.lastIndex = 0
  return hit
}

/** Vrai si le texte contient encore une PII détectable (garde-fou de test et de log). */
export function containsPii(input: string): boolean {
  const s = input || ""
  if ([EMAIL_RE, OTP_RE, PHONE_RE, GPS_RE, BP_RE, STREET_RE, CARD_RE].some((re) => hits(re, s))) {
    return true
  }
  if (hasMobile9(s)) return true
  return redactIban(s) !== s
}
