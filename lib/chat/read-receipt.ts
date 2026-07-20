/**
 * Accusé de lecture honnête (liste + bulle).
 * - Tick uniquement si le dernier message est le nôtre
 * - Double bleu = lu ; simple gris = envoyé ; rien = message entrant
 */
export type ReadReceiptState = "none" | "sent" | "read"

export function resolveReadReceipt(input: {
  viewerId: string
  lastSenderId?: string | null
  isRead?: boolean | null
}): ReadReceiptState {
  if (!input.lastSenderId || input.lastSenderId !== input.viewerId) return "none"
  return input.isRead ? "read" : "sent"
}
