import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub"

// Données fictives.
describe("scrubSentryEvent", () => {
  it("retire cookies, autorisation, IP, e-mail et masque les coordonnées", () => {
    const event = {
      message: "Échec pour ama@test.ci au 0712345678",
      request: {
        url: "https://mygwa.org/api/x?email=ama@test.ci",
        cookies: { "sb-access-token": "secret" },
        data: { password: "x" },
        headers: {
          Cookie: "sb=1",
          Authorization: "Bearer abc",
          "x-forwarded-for": "198.51.100.1",
          "user-agent": "Mozilla",
        },
      },
      user: { id: "u-1", email: "ama@test.ci", ip_address: "198.51.100.1" },
      exception: { values: [{ type: "Error", value: "IBAN CI93 CI00 0001 2345 6789 0123 45 refusé" }] },
      breadcrumbs: [{ message: "Wave 712345678" }],
    }
    const out = scrubSentryEvent(structuredClone(event))
    const json = JSON.stringify(out)
    expect(json).not.toMatch(/ama@test\.ci|0712345678|712345678|secret|Bearer|198\.51\.100\.1|CI93 CI00/)
    expect(out.request.headers).toEqual({ "user-agent": "Mozilla" })
    expect(out.request).not.toHaveProperty("cookies")
    expect(out.request).not.toHaveProperty("data")
    expect(out.user).toEqual({ id: "u-1" })
    expect(out.message).toContain("[email masqué]")
    expect(out.exception.values[0].value).toContain("[IBAN masqué]")
  })

  it("les 3 configs Sentry posent sendDefaultPii: false et beforeSend", () => {
    // Navigateur : instrumentation-client.ts (Next 16) ; serveur et edge : sentry.*.config.ts
    for (const file of ["instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
      const src = readFileSync(file, "utf8")
      expect(src).toMatch(/sendDefaultPii:\s*false/)
      expect(src).toMatch(/beforeSend:\s*\(event\)\s*=>\s*scrubSentryEvent\(event\)/)
    }
  })
})

describe("scrubSentryEvent — paramètres d'URL sensibles", () => {
  // Valeurs fictives.
  it("retire token= et les autres secrets de l'URL, de la query string et des breadcrumbs", () => {
    const event = {
      request: {
        url: "https://mygwa.org/auth/reset?token=abc123SECRET&lang=fr&code=OAUTHCODE#access_token=JWTVALUE&type=recovery",
        query_string: "token=abc123SECRET&lang=fr&apikey=KEYVALUE",
      },
      breadcrumbs: [
        { category: "fetch", data: { url: "https://x.supabase.co/rest/v1/p?select=*&apikey=ANONKEY" } },
        { category: "navigation", data: { to: "/verify?Token=UPPER1&otp=123456" } },
      ],
      spans: [{ data: { "http.url": "https://s3.example/obj?X-Amz-Signature=SIGVALUE&x=1" } }],
      message: "échec lien token=FREETEXT",
    }
    const out = scrubSentryEvent(structuredClone(event))
    const json = JSON.stringify(out)
    expect(json).not.toMatch(/abc123SECRET|OAUTHCODE|JWTVALUE|KEYVALUE|ANONKEY|UPPER1|123456|SIGVALUE|FREETEXT/)
    expect(out.request.url).toBe(
      "https://mygwa.org/auth/reset?token=[Filtered]&lang=fr&code=[Filtered]#access_token=[Filtered]&type=recovery",
    )
    expect(out.request.query_string).toBe("token=[Filtered]&lang=fr&apikey=[Filtered]")
  })

  it("gère la query string en paires ou en objet, sans toucher aux paramètres anodins", () => {
    const pairs = scrubSentryEvent({ request: { query_string: [["token", "T1"], ["page", "2"]] } })
    expect(pairs.request.query_string).toEqual([["token", "[Filtered]"], ["page", "2"]])
    const obj = scrubSentryEvent({ request: { query_string: { refresh_token: "R1", q: "cacao" } } })
    expect(obj.request.query_string).toEqual({ refresh_token: "[Filtered]", q: "cacao" })
    const plain = scrubSentryEvent({ request: { url: "https://mygwa.org/recherche?q=cacao&tokenizer=1&page=2" } })
    expect(plain.request.url).toBe("https://mygwa.org/recherche?q=cacao&tokenizer=1&page=2")
  })
})
