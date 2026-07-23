import { describe, it, expect } from "vitest"
import { isLowQualityPostContent } from "@/lib/feed/content-quality"

describe("isLowQualityPostContent", () => {
  it("détecte le marketing démo GWA", () => {
    expect(
      isLowQualityPostContent(
        "Qu'est ce que vous attendez pour nous rejoindre dans l'aventure GWA qui sera celui de la prospérité",
      ),
    ).toBe(true)
  })

  it("laisse passer un post normal", () => {
    expect(isLowQualityPostContent("Récolte de tomates fraîches à Abidjan")).toBe(false)
  })
})
