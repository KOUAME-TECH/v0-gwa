import { describe, expect, it } from "vitest"
import {
  buildChatStoragePath,
  extractChatStoragePath,
  sanitizeFileName,
  validateChatMedia,
  ChatUploadError,
} from "@/lib/chat/upload"

describe("sanitizeFileName", () => {
  it("retire caractères dangereux et normalise", () => {
    expect(sanitizeFileName("../../etc/passwd.jpg")).toBe("passwd.jpg")
    expect(sanitizeFileName("Photo été (1).PNG")).toMatch(/\.png$/i)
    expect(sanitizeFileName("a<script>.pdf")).toBe("a-script.pdf")
  })

  it("borne la longueur", () => {
    const long = `${"a".repeat(200)}.pdf`
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(90)
  })
})

describe("validateChatMedia", () => {
  it("accepte image jpeg dans la limite", () => {
    expect(
      validateChatMedia({ kind: "image", mime: "image/jpeg", size: 1000 }),
    ).toEqual({ ok: true })
  })

  it("refuse image trop lourde", () => {
    const r = validateChatMedia({
      kind: "image",
      mime: "image/jpeg",
      size: 20 * 1024 * 1024,
    })
    expect(r.ok).toBe(false)
  })

  it("accepte vocal webm", () => {
    expect(
      validateChatMedia({ kind: "voice", mime: "audio/webm", size: 5000 }),
    ).toEqual({ ok: true })
  })

  it("refuse exe", () => {
    const r = validateChatMedia({
      kind: "file",
      mime: "application/x-msdownload",
      size: 100,
    })
    expect(r.ok).toBe(false)
  })
})

describe("buildChatStoragePath", () => {
  const uid = "11111111-1111-4111-8111-111111111111"
  const cid = "22222222-2222-4222-8222-222222222222"

  it("préfixe avec userId (RLS)", () => {
    const path = buildChatStoragePath({
      userId: uid,
      conversationId: cid,
      mime: "image/jpeg",
      fileName: "photo.jpg",
      now: 1700000000000,
    })
    expect(path.startsWith(`${uid}/${cid}/`)).toBe(true)
    expect(path.endsWith(".jpg")).toBe(true)
  })

  it("rejette ids invalides", () => {
    expect(() =>
      buildChatStoragePath({
        userId: "x",
        conversationId: cid,
        mime: "image/jpeg",
        fileName: "a.jpg",
      }),
    ).toThrow(ChatUploadError)
  })
})

describe("extractChatStoragePath", () => {
  it("extrait depuis URL publique", () => {
    const path = extractChatStoragePath(
      "https://xxx.supabase.co/storage/v1/object/public/chat-media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/1-photo.jpg",
    )
    expect(path).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/1-photo.jpg",
    )
  })
})
