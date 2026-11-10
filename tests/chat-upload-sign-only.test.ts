import { describe, expect, it, vi } from "vitest"
import { resolveChatMediaUrl, uploadChatMedia, ChatUploadError } from "@/lib/chat/upload"

describe("chat media sign-only (bucket privé)", () => {
  const uid = "11111111-1111-4111-8111-111111111111"
  const cid = "22222222-2222-4222-8222-222222222222"

  it("resolveChatMediaUrl refuse le fallback public", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "denied" },
    })
    const supabase = {
      auth: { getSession: async () => ({ data: { session: null } }) },
      storage: {
        from: () => ({ createSignedUrl }),
      },
    }
    const url = await resolveChatMediaUrl(
      supabase,
      `${uid}/${cid}/1-photo.jpg`,
    )
    expect(url).toBeNull()
    expect(createSignedUrl).toHaveBeenCalled()
  })

  it("uploadChatMedia échoue si sign impossible (pas de public URL)", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "nope" },
    })
    // XHR mock minimal
    class FakeXHR {
      status = 200
      responseText = "{}"
      upload = { onprogress: null as null | ((e: ProgressEvent) => void) }
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      open() {}
      setRequestHeader() {}
      send() {
        queueMicrotask(() => this.onload?.())
      }
    }
    // @ts-expect-error test stub
    globalThis.XMLHttpRequest = FakeXHR

    const supabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "tok" } },
        }),
      },
      storage: { from: () => ({ createSignedUrl }) },
    }

    await expect(
      uploadChatMedia({
        supabase,
        supabaseUrl: "https://xxx.supabase.co",
        userId: uid,
        conversationId: cid,
        file: new Blob(["x"], { type: "image/jpeg" }),
        fileName: "photo.jpg",
        mime: "image/jpeg",
        kind: "image",
      }),
    ).rejects.toBeInstanceOf(ChatUploadError)
  })
})
