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
    return "Le Digest, c’est l’écoute des nouveautés près de chez toi. Va dans Boutique, appuie sur Écouter — et laisse tourner. Si ça coupe, vérifie juste le son du téléphone."
  }
  if (/kyc|vérif|identit|badge|document/.test(m)) {
    return "Pour le badge vérifié : ouvre Profil, puis Vérification. Envoie une photo nette de ta pièce — l’équipe regarde et te dit oui. Tranquille, ça prend souvent moins d’un jour."
  }
  if (/scg|score|confiance|bancable/.test(m)) {
    return "Ton score de confiance, c’est la confiance des autres sur toi. Remplis bien ton profil, livre correctement, reste cool dans les messages — ça monte tout seul."
  }
  if (/commande|escrow|paiement|payer|feex|argent/.test(m)) {
    return "Quand tu paies, l’argent est gardé en sécurité jusqu’à ce que tu confirmes la réception. Tu suis tout dans Mes commandes. Souci ? Ouvre un litige ou WhatsApp."
  }
  if (/publier|offre|vendre|produit/.test(m)) {
    return "Pour vendre : Publier → mets le nom, le prix, des photos claires, ta ville et ton pays. Comme ça tu sors dans le Digest local. On gère."
  }
  if (/panier|acheter|marketplace|boutique/.test(m)) {
    return "Pour acheter : Boutique, choisis, ajoute au panier, et valide. Tu peux d’abord écrire au vendeur dans Messages si tu veux négocier."
  }
  if (/whatsapp|contact|aide|humain|support|quelqu.?un/.test(m)) {
    return "Pour parler à une vraie personne : WhatsApp +225 07 88 32 60 19. Moi je reste là pour les questions rapides."
  }
  if (/coopérat|cooperative/.test(m)) {
    return "Les coopératives ont leur vitrine sur GWA. Cherche « Coopératives » ou demande à ton admin de t’ajouter. Simple."
  }
  if (page?.includes("profil")) {
    return "Sur Profil tu changes ta photo, ta bio, tes lieux… Dis-moi ce que tu veux régler, je te guide."
  }
  return "Dis-moi juste ce dont tu as besoin — vendre, acheter, une commande, ou parler à quelqu’un. On avance ensemble."
}

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
  if (opts.page) systemParts.push(`Page actuelle : ${opts.page}`)
  if (opts.contextHint) systemParts.push(`Contexte : ${opts.contextHint}`)

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
        temperature: 0.85,
        max_tokens: 220,
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
