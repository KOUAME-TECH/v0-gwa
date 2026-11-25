import { describe, expect, it } from "vitest"
import { containsPii, redactPiiForAi } from "@/lib/yelly/pii"

// Numéros et IBAN fictifs, construits pour les tests (aucune donnée réelle).
describe("redactPiiForAi : conditions QA Lot D", () => {
  describe("IBAN", () => {
    const positives = [
      "CI93 CI00 0001 2345 6789 0123 45",
      "CI93CI000001234567890123 45",
      "CI93CI0000012345678901234",
      "FR76 3000 6000 0112 3456 7890 189",
      "fr7630006000011234567890189",
    ]
    for (const iban of positives) {
      it(`masque ${iban.slice(0, 4)}… (${iban.includes(" ") ? "avec" : "sans"} espaces)`, () => {
        const out = redactPiiForAi(`Mon IBAN : ${iban} merci`)
        expect(out).toContain("[IBAN masqué]")
        expect(out).not.toMatch(/\d{4}/)
        expect(out).toContain("merci")
        expect(containsPii(iban)).toBe(true)
        expect(containsPii(out)).toBe(false)
      })
    }
  })

  describe("téléphones ivoiriens", () => {
    const positives = [
      "2250712345678",
      "225 07 12 34 56 78",
      "22507-12-34-56-78",
      "+2250712345678",
      "00225 07 12 34 56 78",
      "0712345678",
      "07 12 34 56 78",
      "0512345678",
      "712345678",
      "512345678",
      "7 12 34 56 78",
      "Wave 112345678",
    ]
    for (const tel of positives) {
      it(`masque « ${tel.replace(/\d/g, "9")} »`, () => {
        const out = redactPiiForAi(`Appelle-moi au ${tel} stp`)
        expect(out).toContain("[téléphone masqué]")
        expect(out).not.toMatch(/\d{2}/)
        expect(containsPii(tel)).toBe(true)
        expect(containsPii(out)).toBe(false)
      })
    }
  })

  describe("pas de faux positifs", () => {
    const negatives = [
      "Je propose 15000 FCFA",
      "150000000 FCFA pour tout le stock",
      "Budget 150000000 F",
      "Livraison de 500000000 kg ? non, 500 kg",
      "45 000 FCFA les 100 kg",
      "1 250 000 F CFA",
      "Récolte 2025, livraison en 2026",
      "Commande GWA-712345678",
      "Commande GWA-2250712345678",
      "Référence GWA-0712345678",
      "un lot de 50 sacs de cacao",
      "Prix indicatif 405–495 FCFA",
      "CI93 trop court",
      "Ville : Daloa, région du Haut-Sassandra",
    ]
    for (const text of negatives) {
      it(`laisse intact « ${text} »`, () => {
        expect(redactPiiForAi(text)).toBe(text)
        expect(containsPii(text)).toBe(false)
      })
    }
  })

  it("containsPii détecte aussi un OTP", () => {
    expect(containsPii("otp 482913")).toBe(true)
    expect(containsPii(redactPiiForAi("otp 482913"))).toBe(false)
  })

  it("texte mixte : tout est masqué, le contexte utile reste", () => {
    const out = redactPiiForAi(
      "Paie 45 000 FCFA sur Wave 712345678 ou vire sur CI93 CI00 0001 2345 6789 0123 45, commande GWA-1234",
    )
    expect(out).toContain("45 000 FCFA")
    expect(out).toContain("GWA-1234")
    expect(out).toContain("[téléphone masqué]")
    expect(out).toContain("[IBAN masqué]")
    expect(containsPii(out)).toBe(false)
  })
})
