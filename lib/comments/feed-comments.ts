import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCommentMediaType } from "@/lib/comments/voice-comment"
import { extensionForType, normalizeAudioMime } from "@/lib/media/compress"

export type FeedCommentTarget = { type: "post" | "product"; id: string }

export type FeedCommentRow = {
  id: string
  content: string | null
  audio_url: string | null
  comment_type: string
  created_at: string
  parent_comment_id?: string | null
  likes_count?: number
  liked_by_me?: boolean
  replies?: FeedCommentRow[]
  author: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

const VOICE_COLUMN_HINTS = ["comment_type", "audio_url", "review_type", "42703"]

export function isVoiceSchemaError(message?: string): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return VOICE_COLUMN_HINTS.some((h) => m.includes(h.toLowerCase()))
}

function tableMeta(target: FeedCommentTarget) {
  if (target.type === "post") {
    return {
      table: "post_comments" as const,
      idField: "post_id",
      authorField: "author_id",
      countTable: "posts" as const,
      contentKey: "content" as const,
    }
  }
  return {
    table: "reviews" as const,
    idField: "product_id",
    authorField: "reviewer_id",
    countTable: "products" as const,
    contentKey: "comment" as const,
  }
}

function nestComments(rows: FeedCommentRow[]): FeedCommentRow[] {
  const byId = new Map<string, FeedCommentRow>()
  const roots: FeedCommentRow[] = []
  for (const row of rows) {
    byId.set(row.id, { ...row, replies: [] })
  }
  for (const row of rows) {
    const node = byId.get(row.id)!
    const parentId = row.parent_comment_id
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.replies!.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Charge les commentaires / avis (avec likes + réponses pour les posts). */
export async function loadFeedComments(
  supabase: SupabaseClient,
  target: FeedCommentTarget,
  currentUserId?: string | null,
): Promise<FeedCommentRow[]> {
  const { table, idField, authorField } = tableMeta(target)

  const voiceSelect =
    table === "post_comments"
      ? "id, content, comment_type, audio_url, created_at, author_id, parent_comment_id, likes_count"
      : "id, comment, review_type, audio_url, created_at, reviewer_id, parent_review_id, likes_count"
  const basicSelect =
    table === "post_comments"
      ? "id, content, created_at, author_id, parent_comment_id, likes_count"
      : "id, comment, created_at, reviewer_id, parent_review_id, likes_count"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any = await (supabase.from(table) as any)
    .select(voiceSelect)
    .eq(idField, target.id)
    .order("created_at", { ascending: true })
    .limit(100)

  if (res.error && isVoiceSchemaError(res.error.message)) {
    res = await (supabase.from(table) as any)
      .select(basicSelect)
      .eq(idField, target.id)
      .order("created_at", { ascending: true })
      .limit(100)
  }

  // Fallback si parent/likes absents
  if (res.error && /parent_comment_id|likes_count/i.test(res.error.message)) {
    res = await (supabase.from(table) as any)
      .select(
        table === "post_comments"
          ? "id, content, comment_type, audio_url, created_at, author_id"
          : "id, comment, review_type, audio_url, created_at, reviewer_id",
      )
      .eq(idField, target.id)
      .order("created_at", { ascending: false })
      .limit(50)
  }

  if (res.error) throw res.error
  const rawData = (res.data ?? []) as Record<string, unknown>[]
  if (rawData.length === 0) return []

  const userIds = [...new Set(rawData.map((c) => c[authorField] as string))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds)

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

  let likedIds = new Set<string>()
  if (currentUserId) {
    const commentIds = rawData.map((c) => c.id as string)
    const likesTable = target.type === "post" ? "comment_likes" : "review_likes"
    const likesFk = target.type === "post" ? "comment_id" : "review_id"
    const { data: likes } = await (supabase.from(likesTable) as any)
      .select(likesFk)
      .eq("user_id", currentUserId)
      .in(likesFk, commentIds)
    likedIds = new Set(
      ((likes || []) as Record<string, string>[]).map((l) => l[likesFk]),
    )
  }

  const flat: FeedCommentRow[] = rawData.map((c) => ({
    id: c.id as string,
    content: (c.content ?? c.comment ?? null) as string | null,
    audio_url: (c.audio_url ?? null) as string | null,
    comment_type: (c.comment_type ?? c.review_type ?? "text") as string,
    created_at: c.created_at as string,
    parent_comment_id:
      ((c.parent_comment_id ?? c.parent_review_id) as string | null | undefined) ?? null,
    likes_count: Number(c.likes_count ?? 0),
    liked_by_me: likedIds.has(c.id as string),
    author: profileMap.get(c[authorField] as string) || null,
  }))

  return nestComments(flat).reverse()
}

export type SubmitFeedCommentInput = {
  target: FeedCommentTarget
  userId: string
  text?: string
  audioFile?: File | null
  parentCommentId?: string | null
}

export type SubmitFeedCommentResult = {
  comment: FeedCommentRow
  voiceStored: boolean
}

export class CommentSubmitError extends Error {
  constructor(
    message: string,
    readonly code: "AUTH" | "VALIDATION" | "UPLOAD" | "SCHEMA" | "DB",
  ) {
    super(message)
    this.name = "CommentSubmitError"
  }
}

/** Envoie un commentaire texte et/ou vocal (réponse optionnelle). */
export async function submitFeedComment(
  supabase: SupabaseClient,
  input: SubmitFeedCommentInput,
): Promise<SubmitFeedCommentResult> {
  const { target, userId, text = "", audioFile, parentCommentId } = input
  const hasText = !!text.trim()
  const hasVoice = !!audioFile && audioFile.size > 0

  if (!hasText && !hasVoice) {
    throw new CommentSubmitError("Écrivez un message ou enregistrez votre voix.", "VALIDATION")
  }

  const { table, idField, authorField, countTable, contentKey } = tableMeta(target)

  let audioUrl: string | null = null
  if (hasVoice && audioFile) {
    const mime = normalizeAudioMime(audioFile.type)
    const ext = extensionForType(mime) || "webm"
    const fileName = `${userId}/comments/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const payload = audioFile.type === mime ? audioFile : new File([audioFile], audioFile.name, { type: mime })

    const { error: uploadError } = await supabase.storage
      .from("posts")
      .upload(fileName, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: mime,
      })

    if (uploadError) {
      const msg = uploadError.message.toLowerCase()
      if (msg.includes("mime") || msg.includes("type")) {
        throw new CommentSubmitError(
          "Ce format audio n'est pas accepté. Essayez plutôt un message texte.",
          "UPLOAD",
        )
      }
      throw new CommentSubmitError(
        "L'envoi audio a échoué. Vérifiez votre connexion, puis réessayez.",
        "UPLOAD",
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("posts").getPublicUrl(fileName)
    audioUrl = publicUrl
  }

  const mediaType = resolveCommentMediaType({ hasText, hasAudio: !!audioUrl })
  const textValue = hasText ? text.trim() : null
  const parent = parentCommentId || null

  const richInsert =
    table === "post_comments"
      ? {
          [idField]: target.id,
          author_id: userId,
          content: textValue,
          comment_type: mediaType,
          audio_url: audioUrl,
          ...(parent ? { parent_comment_id: parent } : {}),
        }
      : {
          [idField]: target.id,
          reviewer_id: userId,
          comment: textValue,
          review_type: mediaType,
          audio_url: audioUrl,
          rating: 5,
          ...(parent ? { parent_review_id: parent } : {}),
        }

  const basicInsert =
    table === "post_comments"
      ? {
          [idField]: target.id,
          author_id: userId,
          content: textValue || "Note vocale",
          ...(parent ? { parent_comment_id: parent } : {}),
        }
      : {
          [idField]: target.id,
          reviewer_id: userId,
          comment: textValue || "Note vocale",
          rating: 5,
          ...(parent ? { parent_review_id: parent } : {}),
        }

  const richSelect =
    table === "post_comments"
      ? "id, content, comment_type, audio_url, created_at, author_id, parent_comment_id, likes_count"
      : "id, comment, review_type, audio_url, created_at, reviewer_id, parent_review_id, likes_count"
  const basicSelect =
    table === "post_comments"
      ? "id, content, created_at, author_id, parent_comment_id, likes_count"
      : "id, comment, created_at, reviewer_id, parent_review_id, likes_count"

  let voiceStored = !!audioUrl
  let data: Record<string, unknown> | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res = await (supabase.from(table) as any)
    .insert(richInsert)
    .select(richSelect)
    .single()

  if (res.error) {
    if (hasVoice && isVoiceSchemaError(res.error.message)) {
      if (audioUrl) {
        throw new CommentSubmitError(
          "Les notes vocales arrivent bientôt. Envoyez un message texte pour l'instant.",
          "SCHEMA",
        )
      }
      res = await (supabase.from(table) as any).insert(basicInsert).select(basicSelect).single()
      voiceStored = false
    } else if (isVoiceSchemaError(res.error.message) || /parent_comment_id|likes_count/i.test(res.error.message)) {
      const fallback = { ...basicInsert } as Record<string, unknown>
      delete fallback.parent_comment_id
      res = await (supabase.from(table) as any)
        .insert(fallback)
        .select(table === "post_comments" ? "id, content, created_at, author_id" : basicSelect)
        .single()
      voiceStored = false
    }
  }

  if (res.error) {
    throw new CommentSubmitError(
      "Impossible d'envoyer votre message. Réessayez dans un instant.",
      "DB",
    )
  }

  data = res.data as Record<string, unknown>

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", userId)
    .single()

  const comment: FeedCommentRow = {
    id: data.id as string,
    content: (data[contentKey] ?? null) as string | null,
    audio_url: voiceStored ? (data.audio_url as string | null) ?? audioUrl : null,
    comment_type: (data.comment_type ?? data.review_type ?? mediaType) as string,
    created_at: data.created_at as string,
    parent_comment_id:
      ((data.parent_comment_id ?? data.parent_review_id) as string | null | undefined) ??
      parent,
    likes_count: Number(data.likes_count ?? 0),
    liked_by_me: false,
    replies: [],
    author: profile,
  }

  // Compteur : triggers SQL recalculent ; best-effort UI
  if (!parent) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(idField, target.id)
      .is(
        table === "post_comments" ? "parent_comment_id" : "parent_review_id",
        null,
      )
    if (typeof count === "number") {
      await supabase.from(countTable).update({ comments_count: count }).eq("id", target.id)
    }
  }

  return { comment, voiceStored }
}

/** Like / unlike un commentaire (post) ou un avis (produit). */
export async function toggleCommentLike(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  targetType: "post" | "product" = "post",
): Promise<{ liked: boolean; likes_count: number }> {
  const likesTable = targetType === "post" ? "comment_likes" : "review_likes"
  const likesFk = targetType === "post" ? "comment_id" : "review_id"
  const parentTable = targetType === "post" ? "post_comments" : "reviews"

  const { data: existing } = await (supabase.from(likesTable) as any)
    .select("id")
    .eq(likesFk, commentId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) {
    await (supabase.from(likesTable) as any).delete().eq("id", existing.id)
  } else {
    const { error } = await (supabase.from(likesTable) as any).insert({
      [likesFk]: commentId,
      user_id: userId,
    })
    if (error) {
      throw new CommentSubmitError(
        "Impossible d'aimer ce commentaire pour le moment.",
        "DB",
      )
    }
  }

  const { data: row } = await (supabase.from(parentTable) as any)
    .select("likes_count")
    .eq("id", commentId)
    .maybeSingle()

  return {
    liked: !existing,
    likes_count: Number(row?.likes_count ?? 0),
  }
}
