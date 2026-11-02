import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { filterMessagesByQuery, messageMatchesQuery } from "@/lib/chat/search"
import { didLongPress, LONG_PRESS_MS } from "@/lib/chat/long-press"
import {
  draftKey,
  saveChatDraft,
  loadChatDraft,
  clearChatDraft,
  hideMessageForMe,
  loadHiddenMessageIds,
  setMessageReaction,
  loadReactions,
  enqueueOutboxMessage,
  listOutboxForConversation,
  removeOutboxMessage,
  isBrowserOffline,
} from "@/lib/chat/local-store"

/** Polyfill localStorage pour environnement Node (vitest). */
function installMemoryStorage() {
  const store = new Map<string, string>()
  const memory: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => {
      store.delete(k)
    },
    setItem: (k, v) => {
      store.set(k, String(v))
    },
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
  })
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  })
}

describe("recherche conversation", () => {
  const msgs = [
    { id: "1", content: "Prix du cacao", message_type: "text" },
    { id: "2", content: "photo.jpg", message_type: "image" },
    { id: "3", content: "Message vocal (0:12)", message_type: "voice" },
  ]

  it("filtre par texte (sans accent)", () => {
    expect(filterMessagesByQuery(msgs, "cacao")).toHaveLength(1)
    expect(filterMessagesByQuery(msgs, "CACAO")).toHaveLength(1)
    expect(filterMessagesByQuery(msgs, "")).toHaveLength(3)
  })

  it("trouve photo / vocal via type", () => {
    expect(messageMatchesQuery(msgs[1], "photo")).toBe(true)
    expect(messageMatchesQuery(msgs[2], "vocal")).toBe(true)
  })
})

describe("long-press", () => {
  it("respecte le seuil", () => {
    expect(didLongPress(LONG_PRESS_MS - 1)).toBe(false)
    expect(didLongPress(LONG_PRESS_MS)).toBe(true)
  })
})

describe("store local chat (drafts / hide / react / outbox)", () => {
  beforeEach(() => {
    installMemoryStorage()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("sauve et restaure un brouillon", () => {
    expect(draftKey("u1", "c1")).toContain("u1:c1")
    saveChatDraft("u1", "c1", "bonjour ")
    expect(loadChatDraft("u1", "c1")).toBe("bonjour ")
    clearChatDraft("u1", "c1")
    expect(loadChatDraft("u1", "c1")).toBe("")
  })

  it("masque un message pour moi", () => {
    hideMessageForMe("u1", "c1", "m9")
    expect(loadHiddenMessageIds("u1", "c1").has("m9")).toBe(true)
  })

  it("stocke une réaction", () => {
    setMessageReaction("u1", "c1", "m1", "👍")
    expect(loadReactions("u1", "c1").m1).toBe("👍")
    setMessageReaction("u1", "c1", "m1", null)
    expect(loadReactions("u1", "c1").m1).toBeUndefined()
  })

  it("enqueue / retire un message offline", () => {
    const p = enqueueOutboxMessage("u1", {
      conversationId: "c1",
      content: "hors ligne",
    })
    expect(listOutboxForConversation("c1", "u1")).toHaveLength(1)
    removeOutboxMessage(p.id)
    expect(listOutboxForConversation("c1", "u1")).toHaveLength(0)
  })

  it("expose isBrowserOffline", () => {
    expect(typeof isBrowserOffline()).toBe("boolean")
  })
})
