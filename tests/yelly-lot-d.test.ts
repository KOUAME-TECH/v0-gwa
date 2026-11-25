import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/ops/platform-secrets", () => ({
  resolvePlatformSecret: async (key: string) => process.env[key] || "",
}))

import { containsPii, redactPiiForAi } from "@/lib/yelly/pii"
import {
  detectAgreement,
  detectYellyIntent,
  extractAmount,
  referencePriceRange,
  type ChatTurn,
} from "@/lib/yelly/capabilities"
import { buildYellyContext } from "@/lib/yelly/context-builder"
import {
  clearYellyCache,
  genericCacheKey,
  matchFaq,
  readCachedReply,
  writeCachedReply,
  YELLY_CACHE_TTL_MS,
} from "@/lib/yelly/faq-cache"
import { checkYellyUserRateLimit, YELLY_USER_RATE_LIMIT } from "@/lib/yelly/rate-limit"
import { YELLY_DISCLAIMER, YELLY_SYSTEM_PROMPT } from "@/lib/yelly/prompt"

const PII_HISTORY: ChatTurn[] = [
  { author: "autre", text: "Bonjour, appelle-moi au +225 07 11 22 33 44 ou kouassi.ama@gmail.com" },
  { author: "moi", text: "Je livre au 12 rue des Jardins, Cocody, 01 BP 1234 Abidjan 01" },
  { author: "autre", text: "Ma position : 5.3364, -4.0267. Je propose 45 000 FCFA les 100 kg" },
  { author: "moi", text: "D'accord, marché conclu" },
]

describe("PII : rien ne sort vers le modèle", () => {
  it("masque e-mail, téléphone, adresse, BP et GPS", () => {
    const out = redactPiiForAi(PII_HISTORY.map((t) => t.text).join(" | "), 800)
    expect(out).not.toMatch(/kouassi\.ama@gmail\.com/)
    expect(out).not.toMatch(/07 11 22 33 44/)
    expect(out).not.toMatch(/rue des Jardins/)
    expect(out).not.toMatch(/BP 1234/)
    expect(out).not.toMatch(/5\.3364/)
    expect(out).toContain("[adresse masquée]")
    expect(out).toContain("[position masquée]")
    expect(out).toContain("45 000 FCFA")
    expect(out).toContain("Cocody")
    expect(containsPii(out)).toBe(false)
  })

  it("ne confond pas un lot de marchandise avec une adresse", () => {
    expect(redactPiiForAi("un lot de 50 sacs de cacao")).toBe("un lot de 50 sacs de cacao")
  })

  it("le contexte (rôle, produit, historique) est contextualisé et sans PII", () => {
    const ctx = buildYellyContext({
      role: "acheteur",
      product: { name: "Cacao grade 1", price: 500, unit: "kg", city: "Daloa", ocpvReference: 450 },
      history: PII_HISTORY,
      intent: "detect_agreement",
    })
    expect(ctx).toMatch(/Rôle de l’utilisateur : acheteur/)
    expect(ctx).toMatch(/Produit : Cacao grade 1/)
    expect(ctx).toMatch(/Derniers messages du chat/)
    expect(ctx).toMatch(/accord probable/)
    expect(containsPii(ctx)).toBe(false)
  })
})

describe("askYelly : charge utile réellement envoyée à Gemini (fetch simulé)", () => {
  const realFetch = globalThis.fetch
  let captured: string[] = []
  beforeEach(() => {
    captured = []
    process.env.GEMINI_API_KEY = "test-key-not-real"
    globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      captured.push(String(init?.body || ""))
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "Réponse simulée de Yelly, assez longue." }] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    delete process.env.GEMINI_API_KEY
  })

  const scenarios = [
    {
      name: "prix de référence",
      message: "C'est quoi le bon prix pour ce cacao ? mon numéro 0711223344",
      intent: "reference_price",
      expect: /Fourchette indicative calculée : 405–495 FCFA/,
    },
    {
      name: "reformulation d'offre",
      message: "Reformule mon offre : 100 kg à 45000 FCFA livré à Daloa, écris-moi sur ama@test.ci",
      intent: "rephrase_offer",
      expect: /reformule l’offre/,
    },
    {
      name: "détection d'accord + bon de commande",
      message: "Est-ce qu'on est d'accord ? Prépare le bon de commande",
      intent: "purchase_order",
      expect: /bon de commande/,
    },
  ] as const

  for (const sc of scenarios) {
    it(`scénario ${sc.name} : intention, contexte, aucune PII dans la requête`, async () => {
      const { askYelly } = await import("@/lib/yelly/client")
      const message = redactPiiForAi(sc.message, 800)
      const intent = detectYellyIntent(message)
      expect(intent).toBe(sc.intent)
      const contextHint = buildYellyContext({
        role: "acheteur",
        product: { name: "Cacao grade 1", price: 450, unit: "kg", city: "Daloa", ocpvReference: 450 },
        history: PII_HISTORY,
        intent,
      })
      const res = await askYelly({ message, page: "messages/chat", contextHint })
      expect(res.source).toBe("llm")
      expect(captured).toHaveLength(1)
      const body = JSON.parse(captured[0])
      const sent = JSON.stringify(body)
      // Seul le numéro public du support GWA (prompt système statique) est autorisé.
      const dynamicPart = sent.replace(/\+225 07 88 32 60 19/g, "[support GWA]")
      expect(containsPii(dynamicPart)).toBe(false)
      expect(sent).not.toMatch(/0711223344|ama@test\.ci|kouassi/)
      expect(body.system_instruction.parts[0].text).toMatch(sc.expect)
      expect(body.system_instruction.parts[0].text).toMatch(/Rôle de l’utilisateur/)
    })
  }
})

describe("capacités métier", () => {
  it("détecte un accord sur offre structurée acceptée", () => {
    const r = detectAgreement([{ author: "autre", text: "Offre", offerAmount: 40000, offerStatus: "accepted" }])
    expect(r).toMatchObject({ agreed: true, amount: 40000 })
  })
  it("pas d'accord si personne n'accepte", () => {
    const r = detectAgreement([{ author: "autre", text: "Je propose 30 000 FCFA" }])
    expect(r.agreed).toBe(false)
    expect(r.amount).toBe(30000)
  })
  it("extrait un montant FCFA", () => {
    expect(extractAmount("ok pour 12 500 F")).toBe(12500)
    expect(extractAmount("rien")).toBeNull()
  })
  it("fourchette ±10 % basée sur l'OCPV puis le prix affiché", () => {
    expect(referencePriceRange({ listedPrice: 600, ocpvReference: 500 })).toEqual({ low: 450, high: 550, basis: "ocpv" })
    expect(referencePriceRange({ listedPrice: 1000 })).toEqual({ low: 900, high: 1100, basis: "listed" })
    expect(referencePriceRange({})).toBeNull()
  })
  it("intention générale par défaut", () => {
    expect(detectYellyIntent("Bonjour")).toBe("general")
  })
})

describe("cache FAQ", () => {
  beforeEach(() => clearYellyCache())
  it("« Comment payer ? » est servi sans modèle et cite GeniusPay", () => {
    const f = matchFaq("Comment payer ?")
    expect(f?.id).toBe("payer")
    expect(f?.answer).toMatch(/GeniusPay/)
    expect(f?.answer).not.toMatch(/feex/i)
  })
  it("les frais acheteur = 250 F (tarifs officiels)", () => {
    expect(matchFaq("frais acheteur")?.answer).toMatch(/250 F/)
  })
  it("cache mémoire avec expiration", () => {
    const k = genericCacheKey("C'est quoi le Digest ?", "home")
    writeCachedReply(k, "Le Digest…", 1000)
    expect(readCachedReply(k, 2000)).toBe("Le Digest…")
    expect(readCachedReply(k, 1000 + YELLY_CACHE_TTL_MS + 1)).toBeNull()
  })
})

describe("rate limit utilisateur : 10 / minute", () => {
  beforeEach(() => {
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })
  it("autorise 10 appels puis bloque le 11e", async () => {
    expect(YELLY_USER_RATE_LIMIT).toEqual({ maxRequests: 10, windowMs: 60_000 })
    const uid = `user-${Date.now()}`
    const results = []
    for (let i = 0; i < 11; i++) results.push(await checkYellyUserRateLimit(uid))
    expect(results.slice(0, 10).every((r) => r.success)).toBe(true)
    expect(results[10].success).toBe(false)
    // un autre utilisateur n'est pas impacté
    expect((await checkYellyUserRateLimit(`${uid}-b`)).success).toBe(true)
  })
})

describe("gouvernance", () => {
  it("disclaimer exact et prompt sans promesse financière", () => {
    expect(YELLY_DISCLAIMER).toBe("Yelly est une assistante, pas une décision financière.")
    expect(YELLY_SYSTEM_PROMPT).toMatch(/indicatifs/)
  })
})
