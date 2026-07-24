/**
 * Quiet hours support — Abidjan (UTC+0).
 * Escalade humaine hors 08h–20h → message différé WhatsApp.
 */
export function isSupportQuietHours(date = new Date()): boolean {
  const hour = date.getUTCHours() // CI = UTC
  return hour < 8 || hour >= 20
}

export function quietHoursMessage(): string {
  return "L’équipe humaine est dispo de 8h à 20h (Abidjan). Ton ticket est noté — ou WhatsApp +225 07 88 32 60 19 pour l’urgent."
}
