import { describe, it, expect } from "vitest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { organizationJsonLd, productJsonLd, websiteJsonLd } from "@/components/seo/json-ld"

describe("SEO robots + sitemap", () => {
  it("autorise les surfaces publiques et bloque admin/api/auth", () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rules).toBeTruthy()
    const allow = rules.allow
    const disallow = rules.disallow
    const allowList = Array.isArray(allow) ? allow : [allow]
    const denyList = Array.isArray(disallow) ? disallow : [disallow]
    expect(allowList).toEqual(expect.arrayContaining(["/", "/marketplace"]))
    expect(denyList).toEqual(expect.arrayContaining(["/api/", "/admin/", "/auth/"]))
    expect(r.sitemap).toMatch(/sitemap\.xml$/)
  })

  it("expose un sitemap avec home + boutique prioritaires", async () => {
    const entries = await sitemap()
    expect(entries.length).toBeGreaterThanOrEqual(8)
    const urls = entries.map((e) => e.url)
    expect(urls.some((u) => u.endsWith("/") || u.endsWith("mygwa.org"))).toBe(true)
    expect(urls.some((u) => u.includes("/marketplace"))).toBe(true)
    const home = entries.find((e) => e.url.replace(/\/$/, "").endsWith("mygwa.org"))
    const shop = entries.find((e) => e.url.includes("/marketplace"))
    expect(home?.priority).toBe(1)
    expect(shop?.priority).toBeGreaterThanOrEqual(0.9)
  })

  it("JSON-LD Organization / WebSite / Product sont valides", () => {
    const org = organizationJsonLd()
    expect(org["@type"]).toBe("Organization")
    expect(org.url).toMatch(/mygwa\.org/)
    const site = websiteJsonLd()
    expect(site["@type"]).toBe("WebSite")
    expect(site.potentialAction?.["@type"]).toBe("SearchAction")
    const product = productJsonLd({
      id: "abc",
      name: "Tomate",
      price: 1000,
      unit: "kg",
      images: ["https://example.com/t.jpg"],
    })
    expect(product["@type"]).toBe("Product")
    expect(product.offers?.priceCurrency).toBe("XOF")
    expect(product.offers?.price).toBe(1000)
    expect(JSON.stringify(product)).not.toMatch(/<\/script/i)
  })
})
