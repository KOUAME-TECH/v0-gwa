import { describe, it, expect } from "vitest"
import {
  isAiMessage,
  resolveBubbleRole,
  resolveUserChatRole,
  roleLabel,
  bubbleSurfaceClass,
} from "@/lib/chat/roles"

describe("chat roles / bulles", () => {
  it("détecte un message IA", () => {
    expect(isAiMessage({ messageType: "ai" })).toBe(true)
    expect(isAiMessage({ content: "[Conseil IA] Voici une piste" })).toBe(true)
    expect(isAiMessage({ content: "Bonjour" })).toBe(false)
  })

  it("mappe types utilisateur vers acheteur/vendeur", () => {
    expect(resolveUserChatRole("acheteur")).toBe("buyer")
    expect(resolveUserChatRole("producteur")).toBe("seller")
    expect(resolveUserChatRole("cooperative")).toBe("seller")
  })

  it("attribue le rôle bulle selon expéditeur", () => {
    expect(
      resolveBubbleRole({
        senderId: "u1",
        viewerId: "u1",
        viewerUserType: "acheteur",
        content: "ok",
      }),
    ).toBe("buyer")

    expect(
      resolveBubbleRole({
        senderId: "u2",
        viewerId: "u1",
        otherUserType: "producteur",
        content: "ok",
      }),
    ).toBe("seller")

    expect(
      resolveBubbleRole({
        senderId: "gwa-ai",
        viewerId: "u1",
        content: "[Conseil IA] test",
      }),
    ).toBe("ai")
  })

  it("fournit labels et classes distincts", () => {
    expect(roleLabel("buyer")).toBe("Acheteur")
    expect(roleLabel("ai")).toBe("Conseil")
    expect(bubbleSurfaceClass("ai", false)).toContain("FFF8E7")
    expect(bubbleSurfaceClass("buyer", true)).toContain("D6EAF8")
    expect(bubbleSurfaceClass("seller", true)).toContain("D9FDD3")
  })
})
