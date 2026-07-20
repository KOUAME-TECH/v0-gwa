import { describe, it, expect } from "vitest"
import {
  validateVideoFile,
  validateAudioFile,
  isAcceptedImageType,
  buildPostMediaPayload,
  humanFileSize,
  extensionForType,
  resolvePostType,
  productStatusAfterModeration,
  MAX_VIDEO_BYTES,
  MAX_AUDIO_BYTES,
} from "@/lib/media/compress"

describe("media validators (P5)", () => {
  it("accepte une vidéo mp4 de taille correcte", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 5_000_000 }).ok).toBe(true)
  })

  it("refuse un type vidéo non supporté", () => {
    const r = validateVideoFile({ type: "application/pdf", size: 10 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/non support/i)
  })

  it("refuse une vidéo trop lourde", () => {
    const r = validateVideoFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/lourde/i)
  })

  it("accepte un audio et refuse au-delà de la limite", () => {
    expect(validateAudioFile({ type: "audio/mpeg", size: 1000 }).ok).toBe(true)
    expect(validateAudioFile({ type: "audio/mpeg", size: MAX_AUDIO_BYTES + 1 }).ok).toBe(false)
  })

  it("tolère les préfixes image/ et video/", () => {
    expect(isAcceptedImageType("image/heic")).toBe(true)
    expect(validateVideoFile({ type: "video/x-matroska", size: 10 }).ok).toBe(true)
  })

  it("humanFileSize et extensionForType", () => {
    expect(humanFileSize(500)).toBe("500 o")
    expect(humanFileSize(2048)).toBe("2 Ko")
    expect(extensionForType("audio/webm")).toBe("webm")
    expect(extensionForType("video/quicktime")).toBe("mov")
  })
})

describe("buildPostMediaPayload (P6)", () => {
  it("mappe images puis vidéo, audio exclu", () => {
    const out = buildPostMediaPayload(["a.jpg", "b.jpg"], "v.mp4")
    expect(out).toEqual([
      { url: "a.jpg", type: "image" },
      { url: "b.jpg", type: "image" },
      { url: "v.mp4", type: "video" },
    ])
  })

  it("sans vidéo → uniquement les images", () => {
    expect(buildPostMediaPayload(["a.jpg"], null)).toEqual([{ url: "a.jpg", type: "image" }])
  })

  it("aucun média → tableau vide", () => {
    expect(buildPostMediaPayload([], null)).toEqual([])
  })
})

describe("resolvePostType (H1 audio CHECK)", () => {
  it("ne renvoie jamais 'audio' (interdit par le CHECK DB)", () => {
    expect(resolvePostType({ hasAudio: true })).toBe("media")
    expect(resolvePostType({ hasImages: true, hasVideo: true, hasAudio: true })).toBe("media")
    expect(resolvePostType({})).toBe("general")
  })
})

describe("productStatusAfterModeration (H2 reject CHECK)", () => {
  it("reject → paused (pas rejected)", () => {
    expect(productStatusAfterModeration("reject")).toBe("paused")
    expect(productStatusAfterModeration("approve")).toBe("active")
  })
})
