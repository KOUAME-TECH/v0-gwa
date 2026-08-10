import { describe, expect, it } from "vitest"
import { YELLY_GUEST_MAX_PER_DAY } from "@/lib/pricing/entitlements"
import { keywordFallback } from "@/lib/yelly/fallback"
import {
  buildYellyDomainFacts,
  formatYellyUserContext,
  getYellyDomainFacts,
  YELLY_SCG_BANCABLE_THRESHOLD,
  YELLY_SUPPORT_WHATSAPP,
} from "@/lib/yelly/knowledge"
import {
  YELLY_NAME,
  YELLY_SYSTEM_PROMPT,
  YELLY_SUGGESTIONS,
  buildYellySystemPrompt,
  yellySuggestionsForRole,
  yellyWelcomeForRole,
} from "@/lib/yelly/prompt"

describe("Yelly prompt", () => {
  it("defines persona", () => {
    expect(YELLY_NAME).toBe("Yelly")
    expect(YELLY_SYSTEM_PROMPT).toMatch(/Yelly/)
    expect(YELLY_SYSTEM_PROMPT).toMatch(/français/i)
    expect(YELLY_SUGGESTIONS.length).toBeGreaterThan(2)
  })

  it("injecte la fiche métier dans le system prompt", () => {
    const sys = buildYellySystemPrompt({
      userContext: "Rôle: producteur · Palier: Gratuit",
    })
    expect(sys).toMatch(/FICHE GWA/)
    expect(sys).toMatch(/8 %|8%/)
    expect(sys).toMatch(/CONTEXTE UTILISATEUR/)
    expect(sys).toMatch(/producteur/)
    expect(sys).toContain(YELLY_SUPPORT_WHATSAPP)
  })

  it("personnalise suggestions par rôle", () => {
    expect(yellySuggestionsForRole("acheteur").join(" ")).toMatch(/commande/i)
    expect(yellySuggestionsForRole("producteur").join(" ")).toMatch(/publier|SCG|palier/i)
    expect(yellySuggestionsForRole("cooperative").join(" ")).toMatch(/membres|coop/i)
    expect(yellyWelcomeForRole("cooperative")).toMatch(/coop/i)
  })
})

describe("Yelly knowledge", () => {
  it("expose faits alignés code pricing/SCG/coop", () => {
    const facts = getYellyDomainFacts()
    expect(facts.commissionFreePct).toMatch(/8/)
    expect(facts.commissionStarterPct).toMatch(/6\.5/)
    expect(facts.commissionProPct).toMatch(/5/)
    expect(facts.starterMonthlyFcfa).toBe(7500)
    expect(facts.proMonthlyFcfa).toBe(18000)
    expect(facts.scgTrustThreshold).toBe(YELLY_SCG_BANCABLE_THRESHOLD)
    expect(facts.factoringMinScg).toBe(500)
    expect(facts.coopMinMembers).toBe(15)
    expect(buildYellyDomainFacts()).toMatch(/KOUAME Corporation/)
  })

  it("formate le contexte utilisateur", () => {
    const ctx = formatYellyUserContext({
      userType: "producteur",
      tier: "starter",
      scgScore: 420,
      page: "/wallet",
    })
    expect(ctx).toMatch(/producteur/)
    expect(ctx).toMatch(/Starter/)
    expect(ctx).toMatch(/6\.5/)
    expect(ctx).toMatch(/SCG: 420/)
    expect(ctx).toMatch(/wallet/)
  })
})

describe("Yelly keyword fallback", () => {
  it("répond avec chiffres exacts sur commissions", () => {
    const reply = keywordFallback(
      "Quels sont les tarifs d'abonnement et commissions ?",
    )
    expect(reply).toMatch(/8/)
    expect(reply).toMatch(/6\.5/)
    expect(reply).toMatch(/7[\s\u202f]?500|7500/)
  })

  it("explique l'argent protégé / escrow", () => {
    expect(keywordFallback("C'est quoi l'escrow ?")).toMatch(/protégé|escrow/i)
    expect(keywordFallback("Où est mon argent ?")).toMatch(/portefeuille|libéré/i)
  })

  it("explique la coop avec 15 membres", () => {
    expect(keywordFallback("Comment qualifier ma coopérative ?")).toMatch(/15/)
  })
})

describe("Yelly quotas", () => {
  it("guest max is 3 / 24h (shared with /api/yelly/chat)", () => {
    expect(YELLY_GUEST_MAX_PER_DAY).toBe(3)
  })
})
