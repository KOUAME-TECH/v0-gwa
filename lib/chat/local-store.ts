/**
 * Persistance locale chat : brouillons, file offline, masquer « pour moi », réactions.
 * localStorage — léger, synchrone, adapté mobile.
 */

export type PendingChatMessage = {
  id: string
  userId: string
  conversationId: string
  content: string
  replyToId?: string
  createdAt: string
  attempts: number
  lastError?: string
}

export type MessageReactionMap = Record<string, string>

const DRAFT_PREFIX = "gwa-chat-draft:"
const HIDDEN_PREFIX = "gwa-chat-hidden:"
const REACT_PREFIX = "gwa-chat-react:"
const OUTBOX_KEY = "gwa-chat-outbox"

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

/* ── Brouillons ─────────────────────────────────────────── */

export function draftKey(userId: string, conversationId: string): string {
  return `${DRAFT_PREFIX}${userId}:${conversationId}`
}

export function loadChatDraft(userId: string, conversationId: string): string {
  if (!canUseStorage()) return ""
  return localStorage.getItem(draftKey(userId, conversationId)) || ""
}

export function saveChatDraft(
  userId: string,
  conversationId: string,
  text: string,
): void {
  if (!canUseStorage()) return
  const key = draftKey(userId, conversationId)
  const trimmed = text // conserver espaces en cours de frappe
  if (!trimmed.trim()) {
    localStorage.removeItem(key)
    return
  }
  localStorage.setItem(key, trimmed)
}

export function clearChatDraft(userId: string, conversationId: string): void {
  if (!canUseStorage()) return
  localStorage.removeItem(draftKey(userId, conversationId))
}

/* ── Masquer pour moi ───────────────────────────────────── */

export function hiddenKey(userId: string, conversationId: string): string {
  return `${HIDDEN_PREFIX}${userId}:${conversationId}`
}

export function loadHiddenMessageIds(
  userId: string,
  conversationId: string,
): Set<string> {
  if (!canUseStorage()) return new Set()
  const ids = safeParse<string[]>(
    localStorage.getItem(hiddenKey(userId, conversationId)),
    [],
  )
  return new Set(ids)
}

export function hideMessageForMe(
  userId: string,
  conversationId: string,
  messageId: string,
): Set<string> {
  const next = loadHiddenMessageIds(userId, conversationId)
  next.add(messageId)
  if (canUseStorage()) {
    localStorage.setItem(
      hiddenKey(userId, conversationId),
      JSON.stringify([...next]),
    )
  }
  return next
}

/* ── Réactions ───────────────────────────────────────────── */

export function reactionsKey(userId: string, conversationId: string): string {
  return `${REACT_PREFIX}${userId}:${conversationId}`
}

export function loadReactions(
  userId: string,
  conversationId: string,
): MessageReactionMap {
  if (!canUseStorage()) return {}
  return safeParse<MessageReactionMap>(
    localStorage.getItem(reactionsKey(userId, conversationId)),
    {},
  )
}

export function setMessageReaction(
  userId: string,
  conversationId: string,
  messageId: string,
  emoji: string | null,
): MessageReactionMap {
  const map = loadReactions(userId, conversationId)
  if (!emoji) delete map[messageId]
  else map[messageId] = emoji
  if (canUseStorage()) {
    localStorage.setItem(
      reactionsKey(userId, conversationId),
      JSON.stringify(map),
    )
  }
  return map
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"] as const

/* ── File offline (textes) ──────────────────────────────── */

export function loadOutbox(userId?: string): PendingChatMessage[] {
  if (!canUseStorage()) return []
  const all = safeParse<PendingChatMessage[]>(
    localStorage.getItem(OUTBOX_KEY),
    [],
  )
  if (!userId) return all
  return all.filter(
    (m) =>
      m.userId === userId ||
      m.id.includes(`:${userId}:`),
  )
}

export function enqueueOutboxMessage(
  userId: string,
  item: Omit<PendingChatMessage, "id" | "attempts" | "createdAt" | "userId"> & {
    id?: string
  },
): PendingChatMessage {
  const pending: PendingChatMessage = {
    id: item.id || `out:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    userId,
    conversationId: item.conversationId,
    content: item.content,
    replyToId: item.replyToId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  const all = loadOutbox()
  all.push(pending)
  if (canUseStorage()) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(all))
  }
  return pending
}

export function removeOutboxMessage(id: string): void {
  if (!canUseStorage()) return
  const all = loadOutbox().filter((m) => m.id !== id)
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(all))
}

export function listOutboxForConversation(
  conversationId: string,
  userId?: string,
): PendingChatMessage[] {
  return loadOutbox(userId).filter((m) => m.conversationId === conversationId)
}

export function markOutboxAttempt(id: string, error?: string): void {
  if (!canUseStorage()) return
  const all = loadOutbox().map((m) =>
    m.id === id
      ? { ...m, attempts: m.attempts + 1, lastError: error }
      : m,
  )
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(all))
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}
