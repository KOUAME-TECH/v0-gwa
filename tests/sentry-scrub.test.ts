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
