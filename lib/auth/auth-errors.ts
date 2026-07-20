/**
 * Messages d'auth Supabase → FR lisible (2G/3G, agriculteurs).
 */
export function mapAuthErrorMessage(raw: string | null | undefined): string {
  const msg = (raw || "").toLowerCase()
  if (!msg) return "Une erreur est survenue. Réessayez."

  if (
    msg.includes("leaked") ||
    msg.includes("pwned") ||
    msg.includes("haveibeenpwned") ||
    msg.includes("compromis") ||
    msg.includes("weak password") ||
    msg.includes("password is known")
  ) {
    return "Ce mot de passe a déjà été compromis sur d'autres sites. Choisissez-en un autre, plus long et unique."
  }

  if (msg.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect"
  }

  if (msg.includes("user already registered")) {
    return "Un compte existe déjà avec cet email"
  }

  if (msg.includes("password should be at least") || msg.includes("password is too short")) {
    return "Le mot de passe doit contenir au moins 8 caractères"
  }

  return raw || "Une erreur est survenue. Réessayez."
}
