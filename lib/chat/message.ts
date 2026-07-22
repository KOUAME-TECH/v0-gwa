/**
 * GWA — Construction du payload d'un message chat (beta fonctionnelle).
 *
 * Point 10 : garantir que « envoyer → message inséré » produit un payload valide
 * et cohérent (conversation, expéditeur, type, contenu non vide pour le texte).
 * Fonction pure et testable, réutilisée par le composant de conversation.
 */

export type MessageType = "text" | "image" | "voice" | "file" | "offer"

export interface BuildMessageInput {
  conversationId: string
  senderId: string
  content: string
  type?: MessageType
  mediaUrl?: string | null
  replyToId?: string | null
}

export interface MessagePayload {
  conversation_id: string
  sender_id: string
  content: string
  message_type: MessageType
  media_url?: string | null
  reply_to_id?: string
}

export class InvalidMessageError extends Error {}

/**
 * Valide et normalise un message avant insertion.
 * - conversation + expéditeur obligatoires
 * - un message texte doit avoir un contenu non vide
 * - un message média (image/voice/file) doit avoir une media_url
 * - une offre (offer) doit avoir un contenu JSON valide (montant)
 */
export function buildMessagePayload(input: BuildMessageInput): MessagePayload {
  const type: MessageType = input.type || "text"
  const content = (input.content || "").trim()

  if (!input.conversationId) throw new InvalidMessageError("conversation manquante")
  if (!input.senderId) throw new InvalidMessageError("expéditeur manquant")

  if (type === "text" && !content) {
    throw new InvalidMessageError("message texte vide")
  }
  if (type === "offer") {
    if (!content) throw new InvalidMessageError("offre vide")
    try {
      const parsed = JSON.parse(content)
      if (parsed?.kind !== "price_offer" || typeof parsed?.amount !== "number") {
        throw new Error("invalid")
      }
    } catch {
      throw new InvalidMessageError("offre invalide")
    }
  }
  if (type !== "text" && type !== "offer" && !input.mediaUrl) {
    throw new InvalidMessageError("média manquant")
  }

  const payload: MessagePayload = {
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    content,
    message_type: type,
  }
  if (type !== "text" && type !== "offer") payload.media_url = input.mediaUrl ?? null
  if (input.replyToId) payload.reply_to_id = input.replyToId
  return payload
}
