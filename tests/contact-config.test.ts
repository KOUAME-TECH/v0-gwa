import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getAgentMailConfig } from "@/lib/email/agentmail"

const KEYS = [
  "AGENTMAIL_API_KEY",
  "AGENTMAIL_INBOX_ID",
  "AGENTMAIL_FROM",
  "CONTACT_INBOX_TO",
  "AGENTMAIL_CONTACT_TO",
]

describe("destination du formulaire contact (P9)", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("utilise le défaut surveillé par l'équipe si aucun override", () => {
    const cfg = getAgentMailConfig()
    expect(cfg.to).toBe("contact@mygwa.org")
  })

  it("CONTACT_INBOX_TO est prioritaire sur AGENTMAIL_CONTACT_TO", () => {
    process.env.CONTACT_INBOX_TO = "ops@gwa.ci"
    process.env.AGENTMAIL_CONTACT_TO = "fallback@gwa.ci"
    expect(getAgentMailConfig().to).toBe("ops@gwa.ci")
  })

  it("neutralise les guillemets et \\n parasites dans l'env (cas documenté)", () => {
    // Cas réel documenté dans ops-go-live: valeur entre guillemets avec \n final interne
    process.env.CONTACT_INBOX_TO = '"ops@gwa.ci\n"'
    expect(getAgentMailConfig().to).toBe("ops@gwa.ci")
  })

  it("récupère la clé API en supprimant les guillemets", () => {
    process.env.AGENTMAIL_API_KEY = '"sk-test-123"'
    expect(getAgentMailConfig().apiKey).toBe("sk-test-123")
  })
})
