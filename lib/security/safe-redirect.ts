/** N'autorise que des chemins relatifs internes (anti open-redirect). */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith("/")) return null
  if (value.startsWith("//") || value.includes("\\")) return null
  if (/[\u0000-\u001f]/.test(value)) return null
  try {
    const url = new URL(value, "http://gwa.local")
    if (url.origin !== "http://gwa.local") return null
  } catch {
    return null
  }
  return value
}
