/**
 * AgentMail — envoi email contact GWA
 * Docs: https://api.agentmail.to/v0/inboxes/{id}/messages/send
 */

const AGENTMAIL_API = "https://api.agentmail.to/v0"

export function getAgentMailConfig() {
  const apiKey = (process.env.AGENTMAIL_API_KEY || "").replace(/^"|"$/g, "").trim()
  const inboxId = (
    process.env.AGENTMAIL_INBOX_ID ||
    process.env.AGENTMAIL_FROM ||
    "gwa-contact@agentmail.to"
  )
    .replace(/^"|"$/g, "")
    .trim()
  const to = (
    process.env.CONTACT_INBOX_TO ||
    process.env.AGENTMAIL_CONTACT_TO ||
    "gwa-contact@agentmail.to"
  )
    .replace(/^"|"$/g, "")
    .trim()
  return { apiKey, inboxId, to }
}

export async function ensureAgentMailInbox(): Promise<string | null> {
  const { apiKey } = getAgentMailConfig()
  if (!apiKey) return null

  const listRes = await fetch(`${AGENTMAIL_API}/inboxes`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!listRes.ok) return null
  const list = (await listRes.json()) as {
    inboxes?: Array<{ inbox_id?: string; id?: string; email?: string }>
  }
  const existing = list.inboxes?.[0]
  if (existing) return existing.inbox_id || existing.id || existing.email || null

  const createRes = await fetch(`${AGENTMAIL_API}/inboxes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "gwa-contact",
      display_name: "GWA Contact",
    }),
  })
  if (!createRes.ok) {
    console.error("[agentmail] create inbox", await createRes.text())
    return null
  }
  const created = (await createRes.json()) as {
    inbox_id?: string
    id?: string
    email?: string
  }
  return created.inbox_id || created.id || created.email || null
}

export async function sendContactEmail(input: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<{ success: boolean; error?: string }> {
  const { apiKey, to } = getAgentMailConfig()
  if (!apiKey) {
    return { success: false, error: "AGENTMAIL_API_KEY manquante" }
  }

  let inboxId = (process.env.AGENTMAIL_INBOX_ID || "")
    .replace(/^"|"$/g, "")
    .trim()
  if (!inboxId) {
    inboxId = (await ensureAgentMailInbox()) || ""
  }
  if (!inboxId) {
    return { success: false, error: "Inbox AgentMail introuvable" }
  }

  const text = [
    `Nouveau message contact GWA`,
    ``,
    `Nom: ${input.name}`,
    `Email: ${input.email}`,
    `Sujet: ${input.subject}`,
    ``,
    input.message,
  ].join("\n")

  // Ne pas encoder @ : l'API AgentMail attend l'email brut dans le path
  const sendUrl = `${AGENTMAIL_API}/inboxes/${inboxId}/messages/send`

  const res = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: [to],
      subject: `[GWA Contact] ${input.subject}`,
      text,
      reply_to: [input.email],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[agentmail] send", res.status, err)
    // Retry: envoyer vers l'inbox elle-même si destinataire externe échoue
    if (to !== inboxId) {
      const retry = await fetch(sendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: [inboxId],
          subject: `[GWA Contact] ${input.subject}`,
          text,
          reply_to: [input.email],
        }),
      })
      if (retry.ok) return { success: true }
      console.error("[agentmail] retry", retry.status, await retry.text())
    }
    return { success: false, error: "Échec envoi email" }
  }

  return { success: true }
}
