/**
 * Rôles de bulle chat GWA — Acheteur / Vendeur / IA.
 * Labels simples, sans jargon technique.
 */

export type ChatBubbleRole = "buyer" | "seller" | "ai"

export type UserTypeLike = string | null | undefined

const BUYER_TYPES = new Set([
  "acheteur",
  "buyer",
  "business",
  "entreprise",
  "transformateur",
])

const SELLER_TYPES = new Set([
  "farmer",
  "producteur",
  "cooperative",
  "coopérative",
  "vendeur",
  "seller",
])

/** Message IA / conseil (Mission 1 styles ; Mission 2 branchera le contenu). */
export function isAiMessage(input: {
  messageType?: string | null
  content?: string | null
  senderId?: string | null
}): boolean {
  const type = (input.messageType || "").toLowerCase()
  if (type === "ai" || type === "system" || type === "conseil") return true
  const content = input.content || ""
  if (/^\s*\[conseil\s*ia\]/i.test(content)) return true
  if (/^\s*🤖/.test(content)) return true
  if (input.senderId === "gwa-ai" || input.senderId === "yelly") return true
  return false
}

export function resolveUserChatRole(userType: UserTypeLike): ChatBubbleRole {
  const t = (userType || "").toLowerCase().trim()
  if (BUYER_TYPES.has(t)) return "buyer"
  if (SELLER_TYPES.has(t)) return "seller"
  // Défaut marketplace : interlocuteur inconnu = vendeur (offre produit)
  return "seller"
}

/**
 * Rôle affiché pour une bulle : IA > type expéditeur si connu > fallback own/other.
 */
export function resolveBubbleRole(input: {
  messageType?: string | null
  content?: string | null
  senderId: string
  viewerId: string
  senderUserType?: UserTypeLike
  viewerUserType?: UserTypeLike
  otherUserType?: UserTypeLike
}): ChatBubbleRole {
  if (
    isAiMessage({
      messageType: input.messageType,
      content: input.content,
      senderId: input.senderId,
    })
  ) {
    return "ai"
  }

  const own = input.senderId === input.viewerId
  if (input.senderUserType) {
    return resolveUserChatRole(input.senderUserType)
  }
  if (own) {
    return resolveUserChatRole(input.viewerUserType)
  }
  return resolveUserChatRole(input.otherUserType)
}

export function roleLabel(role: ChatBubbleRole): string {
  if (role === "buyer") return "Acheteur"
  if (role === "seller") return "Vendeur"
  return "Conseil"
}

/** Classes Tailwind bulle (contraste WCAG sur fond terre #E8D5B5). */
export function bubbleSurfaceClass(role: ChatBubbleRole, own: boolean): string {
  if (role === "ai") {
    return "bg-[#FFF8E7] border border-[#C27D10]/35 rounded-2xl rounded-tl-md"
  }
  if (own) {
    if (role === "buyer") {
      return "bg-[#D6EAF8] rounded-2xl rounded-tr-md"
    }
    return "bg-[#D9FDD3] rounded-2xl rounded-tr-md"
  }
  if (role === "buyer") {
    return "bg-[#EAF4FB] border border-[#93C5E1]/40 rounded-2xl rounded-tl-md"
  }
  return "bg-white rounded-2xl rounded-tl-md"
}

export function roleBadgeClass(role: ChatBubbleRole): string {
  if (role === "ai") return "text-[#8A5A00] bg-[#F5E6C8]"
  if (role === "buyer") return "text-[#0B4F6C] bg-[#D6EAF8]"
  return "text-[#1F5C2E] bg-[#E8F0E9]"
}
