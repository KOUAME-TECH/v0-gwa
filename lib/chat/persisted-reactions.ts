/**
 * Réactions emoji et « supprimer pour moi » persistées en base (migration 080).
 * Repli silencieux sur le stockage local tant que 080 n'est pas appliquée
 * (table absente → code PostgREST 42P01 / PGRST205).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { MessageReactionMap } from "@/lib/chat/local-store"

export type ReactionRow = { message_id: string; user_id: string; emoji: string }

export type SplitReactions = { own: MessageReactionMap; peer: MessageReactionMap }

export function splitReactions(rows: ReactionRow[], userId: string): SplitReactions {
  const own: MessageReactionMap = {}
  const peer: MessageReactionMap = {}
  for (const r of rows) {
    if (!r?.message_id || !r.emoji) continue
    if (r.user_id === userId) own[r.message_id] = r.emoji
    else peer[r.message_id] = r.emoji
  }
  return { own, peer }
}

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    /does not exist|could not find the table/i.test(error.message || "")
  )
}

/** Libellé affiché sous la bulle : ma réaction puis celle de l'autre, sans doublon. */
export function reactionBadge(own?: string, peer?: string): string | null {
  if (own && peer) return own === peer ? `${own} 2` : `${own}${peer}`
  return own || peer || null
}

export async function loadPersistedChatPrefs(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<{ available: boolean; reactions: SplitReactions; hidden: string[] }> {
  const empty = { own: {}, peer: {} }
  const [reactRes, hiddenRes] = await Promise.all([
    supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji, messages!inner(conversation_id)")
      .eq("messages.conversation_id", conversationId)
      .limit(500),
    supabase
      .from("message_hidden")
      .select("message_id, messages!inner(conversation_id)")
      .eq("user_id", userId)
      .eq("messages.conversation_id", conversationId)
      .limit(1000),
  ])
  if (isMissingRelation(reactRes.error) || isMissingRelation(hiddenRes.error)) {
    return { available: false, reactions: empty, hidden: [] }
  }
  return {
    available: !reactRes.error && !hiddenRes.error,
    reactions: splitReactions((reactRes.data || []) as ReactionRow[], userId),
    hidden: ((hiddenRes.data || []) as { message_id: string }[]).map((r) => r.message_id),
  }
}

export async function persistReaction(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
  emoji: string | null,
): Promise<boolean> {
  if (messageId.startsWith("tmp-") || messageId.startsWith("out:")) return false
  const { error } = emoji
    ? await supabase
        .from("message_reactions")
        .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: "message_id,user_id" })
    : await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId)
  return !error
}

export async function persistHiddenForMe(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
): Promise<boolean> {
  if (messageId.startsWith("tmp-") || messageId.startsWith("out:")) return false
  const { error } = await supabase
    .from("message_hidden")
    .upsert({ message_id: messageId, user_id: userId }, { onConflict: "user_id,message_id" })
  return !error
}
