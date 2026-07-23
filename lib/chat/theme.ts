/** Harmattan Signal — tokens chat GWA (WhatsApp-like, terre Afrique). */
export const CHAT_THEME = {
  primary: "#1F5C2E",
  primaryDark: "#174A24",
  accent: "#C27D10",
  ownBubble: "#D9FDD3",
  otherBubble: "#FFFFFF",
  readTick: "#C27D10",
  sentTick: "#667781",
  /** Terre battue / savane — fond conversation */
  bg: "#E8D5B5",
  inputBg: "#F0F2F5",
} as const

/**
 * Motif wax / kente discret (losanges + bandes) — SVG data-URI.
 * Teintes terre, ocre, vert forêt à très faible opacite.
 */
export const CHAT_AFRICA_BG = {
  color: CHAT_THEME.bg,
  image: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect fill='%23E8D5B5' width='120' height='120'/%3E%3Cg fill='none' stroke='%231F5C2E' stroke-opacity='0.07' stroke-width='1'%3E%3Cpath d='M0 30h120M0 60h120M0 90h120M30 0v120M60 0v120M90 0v120'/%3E%3C/g%3E%3Cg fill='%23C27D10' fill-opacity='0.08'%3E%3Cpath d='M20 20l10 10-10 10-10-10zM80 20l10 10-10 10-10-10zM20 80l10 10-10 10-10-10zM80 80l10 10-10 10-10-10z'/%3E%3C/g%3E%3Cg fill='%231F5C2E' fill-opacity='0.05'%3E%3Ccircle cx='60' cy='60' r='8'/%3E%3Ccircle cx='0' cy='0' r='6'/%3E%3Ccircle cx='120' cy='120' r='6'/%3E%3C/g%3E%3C/svg%3E")`,
} as const
