import { describe, expect, it } from "vitest"
import {
  buildLocationContent,
  isLocationMessage,
  parseLocationContent,
} from "@/lib/chat/location"

describe("chat location", () => {
  it("round-trips JSON payload", () => {
    const raw = buildLocationContent({
      lat: 5.36,
      lon: -4.008,
      address: "Abidjan",
      accuracyM: 12,
    })
    const p = parseLocationContent(raw)
    expect(p?.lat).toBeCloseTo(5.36)
    expect(p?.lon).toBeCloseTo(-4.008)
    expect(p?.address).toBe("Abidjan")
  })

  it("parses legacy OSM text", () => {
    const legacy =
      "📍 Ma position\nPlateau, Abidjan\nhttps://www.openstreetmap.org/?mlat=5.32&mlon=-4.02#map=18/5.32/-4.02"
    const p = parseLocationContent(legacy)
    expect(p?.lat).toBeCloseTo(5.32)
    expect(p?.lon).toBeCloseTo(-4.02)
    expect(isLocationMessage("text", legacy)).toBe(true)
  })
})
