import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import {
  enqueueOutboxMessage,
  markOutboxAttempt,
  outboxHealth,
  pruneFailedOutbox,
} from "@/lib/chat/local-store"

describe("outboxHealth / prune", () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("compte pending et failing sans PII", () => {
    const a = enqueueOutboxMessage("u1", {
      conversationId: "c1",
      content: "bonjour",
    })
    markOutboxAttempt(a.id, "network")
    markOutboxAttempt(a.id, "network")
    markOutboxAttempt(a.id, "network")
    const h = outboxHealth("u1")
    expect(h.pending).toBe(1)
    expect(h.failing).toBe(1)
    expect(h.oldestAgeMs).not.toBeNull()
  })

  it("prune les outbox trop échouées", () => {
    const a = enqueueOutboxMessage("u1", {
      conversationId: "c1",
      content: "x",
    })
    for (let i = 0; i < 8; i++) markOutboxAttempt(a.id)
    expect(pruneFailedOutbox(8)).toBe(1)
    expect(outboxHealth("u1").pending).toBe(0)
  })
})
