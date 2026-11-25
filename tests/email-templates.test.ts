import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import {
  escapeHtml,
  renderOrderConfirmationEmail,
  renderPasswordResetTemplate,
  safeGwaUrl,
} from "@/lib/email/templates"

const order = {
  buyerName: "Awa <script>",
  orderNumber: "GWA-1",
  productName: "Cacao & co",
  quantity: 50,
  unit: "kg",
  subtotal: 100000,
  buyerFee: 250,
  total: 100250,
  orderUrl: "https://mygwa.org/dashboard/commandes",
}

describe("Gabarits e-mail GWA", () => {
  it("confirmation de commande : logo, couleurs, lien, montants, texte alternatif", () => {
    const m = renderOrderConfirmationEmail(order)
    expect(m.subject).toBe("Commande GWA-1 confirmée")
    expect(m.html).toContain('src="https://mygwa.org/icon-192.png"')
    expect(m.html).toContain('alt="GWA"')
    expect(m.html).toContain("#1F5C2E")
    expect(m.html).toContain('href="https://mygwa.org/dashboard/commandes"')
    expect(m.html).toContain("100 250 FCFA")
    expect(m.html).toContain('lang="fr"')
    expect(m.text).toContain("Total payé : 100 250 FCFA")
  })
  it("échappe le HTML injecté", () => {
    const m = renderOrderConfirmationEmail(order)
    expect(m.html).not.toContain("<script>")
    expect(m.html).toContain("Awa &lt;script&gt;")
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;")
  })
  it("refuse les liens hors mygwa.org (anti-hameçonnage)", () => {
    expect(safeGwaUrl("https://evil.example/x")).toBe("https://mygwa.org")
    expect(safeGwaUrl("javascript:alert(1)")).toBe("https://mygwa.org")
    expect(safeGwaUrl("https://mygwa.org/a")).toBe("https://mygwa.org/a")
    expect(renderOrderConfirmationEmail({ ...order, orderUrl: "http://mygwa.org" }).html).not.toContain("http://mygwa.org\"")
  })
  it("réinitialisation : variable Supabase intacte et fichier du dépôt à jour", () => {
    const html = renderPasswordResetTemplate()
    expect(html).toContain('href="{{ .ConfirmationURL }}"')
    expect(readFileSync("emails/password-reset.supabase.html", "utf8").trim()).toBe(html.trim())
  })
})
