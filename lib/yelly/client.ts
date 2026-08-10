import "server-only"
import { buildYellySystemPrompt } from "@/lib/yelly/prompt"
import { keywordFallback } from "@/lib/yelly/fallback"
import { sanitizePlainText } from "@/lib/security/validation"
import { resolvePlatformSecret } from "@/lib/ops/platform-secrets"

export type YellyMessage = { role: "system" | "user" | "assistant"; content: string }

export type YellyChatResult = {
  reply: string
  source: "llm" | "fallback"
  model?: string
}

export type AskYellyInput = {
  message: string
  page?: string
  /** Contexte profil / commandes (formaté). */
  userContext?: string
  /** Alias legacy / admin task — fusionné dans le prompt. */
  contextHint?: string
  history?: YellyMessage[]
  /** Remplace le prompt Yelly mobile (ex. Yelly Ops backoffice). */
  systemPrompt?: string
  locale?: string
}

export { keywordFallback } from "@/lib/yelly/fallback"

async function resolveGeminiKey(): Promise<string> {
  return resolvePlatformSecret("GEMINI_API_KEY", [
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "YELLY_API_KEY",
  ])
}

function resolveModel(): string {
  return (
    process.env.YELLY_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.1-flash-lite"
  ).trim()
}

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
        temperature: 0.4,
        maxOutputTokens: 640,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    console.error("[yelly] Gemini HTTP", res.status, await res.text().catch(() => ""))
    return null
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  }
  const raw = data.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text && !p.thought)
    .map((p) => p.text || "")
    .join("")
    .replace(/\*\*/g, "")
    .trim()
  if (!raw || raw.length < 8) return null

  return {
    reply: sanitizePlainText(raw, 1200),
    source: "llm",
    model: opts.model,
  }
}

async function askOpenAICompat(opts: {
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
      temperature: 0.4,
      max_tokens: 400,
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

export async function askYelly(opts: AskYellyInput): Promise<YellyChatResult> {
  const userMsg = sanitizePlainText(opts.message, 800)
  const geminiKey = await resolveGeminiKey()
  const model = resolveModel()
  const openAiKey = process.env.OPENAI_API_KEY || ""
  const baseUrl = (process.env.YELLY_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  )

  const system = buildYellySystemPrompt({
    locale: opts.locale,
    userContext: opts.userContext,
    contextHint: [opts.page ? `Page actuelle : ${opts.page}` : null, opts.contextHint]
      .filter(Boolean)
      .join("\n") || undefined,
    systemPrompt: opts.systemPrompt,
  })
  const history = (opts.history || []).filter((h) => h.role !== "system").slice(-8)

  if (!geminiKey && !openAiKey) {
    return { reply: keywordFallback(userMsg, opts.page), source: "fallback" }
  }

  try {
    if (geminiKey) {
      const gemini = await askGemini({
        system,
        history,
        userMsg,
        apiKey: geminiKey,
        model: model.includes("gpt") ? "gemini-3.1-flash-lite" : model,
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
