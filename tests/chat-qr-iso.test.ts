import { describe, expect, it } from "vitest"
import { hasIsoFinderPatterns, qrMatrix, qrSvgDataUri } from "@/lib/chat/qr-svg"

describe("QR ISO (lib qrcode)", () => {
  it("produit une matrice avec finders ISO ≥21", () => {
    const m = qrMatrix("https://mygwa.org/dashboard/commandes")
    expect(m.length).toBeGreaterThanOrEqual(21)
    expect(m[0].length).toBe(m.length)
    expect(hasIsoFinderPatterns(m)).toBe(true)
  })

  it("génère un data-URI SVG scannable", () => {
    const uri = qrSvgDataUri("GWA-VERIFY-ABCD1234", 128)
    expect(uri.startsWith("data:image/svg+xml")).toBe(true)
    expect(decodeURIComponent(uri).includes("<svg")).toBe(true)
    expect(decodeURIComponent(uri).includes("QR code")).toBe(true)
  })

  it("deux payloads différents → matrices différentes", () => {
    const a = qrMatrix("https://mygwa.org/a")
    const b = qrMatrix("https://mygwa.org/b")
    const flatA = a.flat().map((v) => (v ? "1" : "0")).join("")
    const flatB = b.flat().map((v) => (v ? "1" : "0")).join("")
    expect(flatA).not.toBe(flatB)
  })
})
