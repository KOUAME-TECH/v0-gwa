import "server-only"
import { YELLY_SYSTEM_PROMPT } from "@/lib/yelly/prompt"
import { sanitizePlainText } from "@/lib/security/validation"

export type YellyMessage = { role: "system" | "user" | "assistant"; content: string }

export type YellyChatResult = {
  reply: string
  source: "llm" | "fallback"
  model?: string
}

function keywordFallback(message: string, page?: string): string {
  const m = message.toLowerCase()
  if (/digest|harmattan|écouter|parcours/.test(m)) {
    return "Le Digest Harmattan, c'est la lecture audio des nouveautés boutique. Ouvre Boutique, puis lance « Écouter ». Tu peux aussi démarrer un Parcours depuis le fil. Si rien ne joue, vérifie le son du téléphone."
  }
  if (/kyc|vérif|identit|badge|document/.test(m)) {
    return "Pour te faire vérifier : Profil → Vérification d'identité, puis envoie une pièce claire (photo nette). L'équipe GWA valide ensuite. Le badge apparaît sur ton profil une fois approuvé."
  }
  if (/scg|score|confiance|bancable/.test(m)) {
    return "Le Score de Confiance (SCG) reflète ton sérieux sur GWA (profil, ventes, avis). Améliore-le en complétant ton profil, en livrant correctement et en gardant de bons échanges."
  }
  if (/commande|escrow|paiement|payer|feex/.test(m)) {
    return "Les commandes passent par un paiement sécurisé (escrow) : l'argent est retenu jusqu'à confirmation de réception. Suis l'état dans Commandes. En litige, ouvre un litige depuis la commande ou contacte le support."
  }
  if (/publier|offre|vendre|produit/.test(m)) {
    return "Pour vendre : Boutique ou Publier → crée ton offre (nom, prix, photos, ville). Indique bien ta ville et ton pays pour apparaître dans le Digest local."
  }
  if (/panier|acheter|marketplace|boutique/.test(m)) {
    return "Pour acheter : ouvre Boutique, choisis un produit, ajoute au panier puis valide. Tu peux discuter avec le vendeur via Messages avant de commander."
  }
  if (/whatsapp|contact|aide|humain|support/.test(m)) {
    return "Pour parler à quelqu'un : WhatsApp +225 07 88 32 60 19, ou la page Contact. Je reste dispo pour les questions GWA rapides."
  }
  if (/coopérat|cooperative/.test(m)) {
    return "Les coopératives ont une vitrine sur GWA. Cherche « Coopératives » dans le menu, ou demande à un admin de t'ajouter comme membre."
  }
  if (page?.includes("profil")) {
    return "Sur Profil tu gères photo, bio, lieux, vérification et préférences Digest. Que veux-tu faire exactement ?"
  }
  return "Je suis Yelly, l'assistante GWA. Je peux t'aider sur boutique, Digest, commandes, vérification et profil. Dis-moi en une phrase ce dont tu as besoin — ou écris-nous sur WhatsApp +225 07 88 32 60 19."
}

/**
 * Appel LLM OpenAI-compatible (OpenAI / Groq / autre).
 * Env : YELLY_API_KEY, YELLY_MODEL, YELLY_BASE_URL (optionnel).
 */
export async function askYelly(opts: {
  message: string
  page?: string
  contextHint?: string
  history?: YellyMessage[]
}): Promise<YellyChatResult> {
  const userMsg = sanitizePlainText(opts.message, 800)
  const apiKey = process.env.YELLY_API_KEY || process.env.OPENAI_API_KEY
  const model = process.env.YELLY_MODEL || "gpt-4o-mini"
  const baseUrl = (process.env.YELLY_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")

  if (!apiKey) {
    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  }

  const systemParts = [YELLY_SYSTEM_PROMPT]
  if (opts.page) systemParts.push(`Page actuelle de l'utilisateur : ${opts.page}`)
  if (opts.contextHint) systemParts.push(`Contexte produit/app : ${opts.contextHint}`)

  const messages: YellyMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...(opts.history || []).slice(-6),
    { role: "user", content: userMsg },
  ]

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 350,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      console.error("[yelly] LLM HTTP", res.status, await res.text().catch(() => ""))
      return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
    }

    return {
      reply: sanitizePlainText(raw, 1200),
      source: "llm",
      model,
    }
  } catch (err) {
    console.error("[yelly] LLM error", err)
    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  }
}
