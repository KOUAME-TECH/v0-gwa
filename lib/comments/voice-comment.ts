export type CommentMediaType = "text" | "voice" | "text_voice"

/** Type DB pour post_comments / reviews selon contenu saisi. */
export function resolveCommentMediaType(input: {
  hasText: boolean
  hasAudio: boolean
}): CommentMediaType {
  if (input.hasText && input.hasAudio) return "text_voice"
  if (input.hasAudio) return "voice"
  return "text"
}

/** Libellé affiché pour un commentaire vocal sans texte. */
export const VOICE_COMMENT_PLACEHOLDER = "Message vocal — appuyez pour écouter"
