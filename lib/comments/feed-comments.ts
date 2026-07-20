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

/** Charge les commentaires / avis avec repli si colonnes vocales absentes. */
export async function loadFeedComments(
  supabase: SupabaseClient,
  target: FeedCommentTarget,
): Promise<FeedCommentRow[]> {
  const { table, idField, authorField } = tableMeta(target)

  const voiceSelect =
    table === "post_comments"
      ? "id, content, comment_type, audio_url, created_at, author_id"
      : "id, comment, review_type, audio_url, created_at, reviewer_id"
  const basicSelect =
    table === "post_comments"
      ? "id, content, created_at, author_id"
      : "id, comment, created_at, reviewer_id"

  let res = await supabase
    .from(table)
    .select(voiceSelect)
    .eq(idField, target.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (res.error && isVoiceSchemaError(res.error.message)) {
    res = await supabase
      .from(table)
      .select(basicSelect)
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

  return rawData.map((c) => ({
    id: c.id as string,
    content: (c.content ?? c.comment ?? null) as string | null,
    audio_url: (c.audio_url ?? null) as string | null,
    comment_type: (c.comment_type ?? c.review_type ?? "text") as string,
    created_at: c.created_at as string,
    author: profileMap.get(c[authorField] as string) || null,
  }))
}

export type SubmitFeedCommentInput = {
  target: FeedCommentTarget
  userId: string
  text?: string
  audioFile?: File | null
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

/** Envoie un commentaire texte et/ou vocal avec repli schéma + messages FR clairs. */
export async function submitFeedComment(
  supabase: SupabaseClient,
  input: SubmitFeedCommentInput,
): Promise<SubmitFeedCommentResult> {
  const { target, userId, text = "", audioFile } = input
  const hasText = !!text.trim()
  const hasVoice = !!audioFile && audioFile.size > 0

  if (!hasText && !hasVoice) {
    throw new CommentSubmitError("Écrivez un commentaire ou enregistrez une note vocale", "VALIDATION")
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
          "Format audio refusé par le serveur. Réessayez ou utilisez un commentaire texte.",
          "UPLOAD",
        )
      }
      throw new CommentSubmitError(
        "Impossible d'envoyer l'audio. Vérifiez votre connexion et réessayez.",
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

  const richInsert =
    table === "post_comments"
      ? {
          [idField]: target.id,
          author_id: userId,
          content: textValue,
          comment_type: mediaType,
          audio_url: audioUrl,
        }
      : {
          [idField]: target.id,
          reviewer_id: userId,
          comment: textValue,
          review_type: mediaType,
          audio_url: audioUrl,
          rating: 5,
        }

  const basicInsert =
    table === "post_comments"
      ? {
          [idField]: target.id,
          author_id: userId,
          content: textValue || (audioUrl ? "🎤 Note vocale" : ""),
        }
      : {
          [idField]: target.id,
          reviewer_id: userId,
          comment: textValue || (audioUrl ? "🎤 Note vocale" : ""),
          rating: 5,
        }

  const richSelect =
    table === "post_comments"
      ? "id, content, comment_type, audio_url, created_at, author_id"
      : "id, comment, review_type, audio_url, created_at, reviewer_id"
  const basicSelect =
    table === "post_comments"
      ? "id, content, created_at, author_id"
      : "id, comment, created_at, reviewer_id"

  let voiceStored = !!audioUrl
  let data: Record<string, unknown> | null = null

  let res = await supabase.from(table).insert(richInsert).select(richSelect).single()

  if (res.error) {
    if (hasVoice && isVoiceSchemaError(res.error.message)) {
      if (audioUrl) {
        throw new CommentSubmitError(
          "Les commentaires vocaux nécessitent la migration SQL 039 sur Supabase. Le texte fonctionne en attendant.",
          "SCHEMA",
        )
      }
      res = await supabase.from(table).insert(basicInsert).select(basicSelect).single()
      voiceStored = false
    } else if (isVoiceSchemaError(res.error.message)) {
      res = await supabase.from(table).insert(basicInsert).select(basicSelect).single()
      voiceStored = false
    }
  }

  if (res.error) {
    throw new CommentSubmitError(
      res.error.message.includes("violates")
        ? "Commentaire refusé. Vérifiez le contenu et réessayez."
        : "Erreur lors de l'envoi du commentaire",
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
    author: profile,
  }

  // Incrémenter le compteur (best-effort)
  const { data: parent } = await supabase
    .from(countTable)
    .select("comments_count")
    .eq("id", target.id)
    .maybeSingle()

  const newCount = ((parent?.comments_count as number) ?? 0) + 1
  await supabase.from(countTable).update({ comments_count: newCount }).eq("id", target.id)

  return { comment, voiceStored }
}
