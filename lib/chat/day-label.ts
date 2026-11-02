/**
 * Libellé de séparateur de jour (style WhatsApp) — FR.
 */

export function chatDayLabel(
  iso: string,
  now: Date = new Date(),
  locale = "fr-FR",
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()

  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000),
  )

  if (diffDays === 0) return "Aujourd’hui"
  if (diffDays === 1) return "Hier"
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString(locale, { weekday: "long" })
  }
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}
