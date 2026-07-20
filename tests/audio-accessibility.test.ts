import { describe, expect, it } from "vitest"
import { buildProductListenText } from "@/lib/media/product-listen"
import { normalizeAudioMime } from "@/lib/media/compress"
import { isVoiceSchemaError } from "@/lib/comments/feed-comments"

describe("buildProductListenText", () => {
  it("inclut nom, prix et description", () => {
    const text = buildProductListenText({
      name: "Cacao bio",
      price: 3000,
      unit: "kg",
      description: "Fèves fermentées",
      origin_region: "San Pedro",
      is_organic: true,
    })
    expect(text).toContain("Cacao bio")
    expect(text).toContain("3")
    expect(text).toContain("Fèves fermentées")
    expect(text).toContain("San Pedro")
    expect(text).toContain("biologique")
  })
})

describe("normalizeAudioMime", () => {
  it("retire le suffixe codecs", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm")
  })
})

describe("isVoiceSchemaError", () => {
  it("détecte colonne manquante", () => {
    expect(isVoiceSchemaError('column "comment_type" does not exist')).toBe(true)
    expect(isVoiceSchemaError("network error")).toBe(false)
  })
})
