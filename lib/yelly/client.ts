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
    return "Les coopératives commencent en validation : ajoute tes membres, puis les docs légaux. Cherche « Coopératives » ou demande à ton admin. Simple."
  }
  if (page?.includes("profil")) {
    return "Sur Profil tu changes ta photo, ta bio, tes lieux… Le type de compte, lui, se fixe à l’inscription — pour le changer, contacte le support. Dis-moi ce que tu veux régler."
  }
  return "Dis-moi juste ce dont tu as besoin — vendre, acheter, une commande, ou parler à quelqu’un. On avance ensemble."
}

function resolveGeminiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.YELLY_API_KEY ||
    ""
  ).trim()
}

function resolveModel(): string {
  return (
    process.env.YELLY_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-flash-latest"
  ).trim()
}

/** Convertit l’historique chat OpenAI-like → contents Gemini. */
function toGeminiContents(
  history: YellyMessage[],
  userMsg: string,
): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const m of history) {
    if (m.role === "system") continue
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })
  }
  contents.push({ role: "user", parts: [{ text: userMsg }] })
  return contents
}

async function askGemini(opts: {
  system: string
  history: YellyMessage[]
  userMsg: string
  apiKey: string
  model: string
}): Promise<YellyChatResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: opts.system }] },
      contents: toGeminiContents(opts.history, opts.userMsg),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 280,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    console.error("[yelly] Gemini HTTP", res.status, await res.text().catch(() => ""))
    return null
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const raw = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim()
  if (!raw) return null

  return {
    reply: sanitizePlainText(raw, 1200),
    source: "llm",
    model: opts.model,
  }
}

/** Fallback OpenAI-compatible si YELLY_BASE_URL + clé dédiée (hors Gemini). */
async function askOpenAICompat(opts: {
  system: string
  messages: YellyMessage[]
  apiKey: string
  model: string
  baseUrl: string
}): Promise<YellyChatResult | null> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: 0.85,
      max_tokens: 220,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    console.error("[yelly] OpenAI HTTP", res.status, await res.text().catch(() => ""))
    return null
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) return null
  return {
    reply: sanitizePlainText(raw, 1200),
    source: "llm",
    model: opts.model,
  }
}

export async function askYelly(opts: {
  message: string
  page?: string
  contextHint?: string
  history?: YellyMessage[]
}): Promise<YellyChatResult> {
  const userMsg = sanitizePlainText(opts.message, 800)
  const geminiKey = resolveGeminiKey()
  const model = resolveModel()
  const openAiKey = process.env.OPENAI_API_KEY || ""
  const baseUrl = (process.env.YELLY_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  )

  const systemParts = [YELLY_SYSTEM_PROMPT]
  if (opts.page) systemParts.push(`Page actuelle : ${opts.page}`)
  if (opts.contextHint) systemParts.push(`Contexte : ${opts.contextHint}`)
  const system = systemParts.join("\n\n")
  const history = opts.history || []

  if (!geminiKey && !openAiKey) {
    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  }

  try {
    // Priorité Gemini (GWA)
    if (geminiKey) {
      const gemini = await askGemini({
        system,
        history,
        userMsg,
        apiKey: geminiKey,
        model: model.includes("gpt") ? "gemini-flash-latest" : model,
      })
      if (gemini) return gemini
    }

    if (openAiKey) {
      const messages: YellyMessage[] = [
        { role: "system", content: system },
        ...history.slice(-6),
        { role: "user", content: userMsg },
      ]
      const openai = await askOpenAICompat({
        system,
        messages,
        apiKey: openAiKey,
        model: process.env.YELLY_OPENAI_MODEL || "gpt-4o-mini",
        baseUrl,
      })
      if (openai) return openai
    }

    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  } catch (err) {
    console.error("[yelly] LLM error", err)
    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  }
}
