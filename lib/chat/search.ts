/**
 * Recherche dans une conversation (texte + aperçus média).
 */

export type SearchableMessage = {
  id: string
  content: string
  message_type?: string | null
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function preview(msg: SearchableMessage): string {
  const t = (msg.message_type || "text").toLowerCase()
  if (t === "voice") return "message vocal"
  if (t === "image") return `photo ${msg.content || ""}`
  if (t === "file") return `document ${msg.content || ""}`
  if (t === "location") return `position ${msg.content || ""}`
  if (t === "offer") return `offre ${msg.content || ""}`
  if (t === "order_sheet") return `bon de commande ${msg.content || ""}`
  if (t === "ai") return `conseil ${msg.content || ""}`
  return msg.content || ""
}

export function filterMessagesByQuery<T extends SearchableMessage>(
  messages: T[],
  query: string,
): T[] {
  const q = normalize(query.trim())
  if (!q) return messages
  return messages.filter((m) => normalize(preview(m)).includes(q))
}

export function messageMatchesQuery(
  msg: SearchableMessage,
  query: string,
): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  return normalize(preview(msg)).includes(q)
}
