/**
 * Sync offline → online : flush file de publication + event refresh.
 */
import { createClient } from "@/lib/supabase/client"
import {
  listPublishQueue,
  markPublishAttempt,
  publishQueueCountEvent,
  removePublishQueueItem,
  type PublishQueueItem,
} from "@/lib/offline/publish-queue"

export type SyncResult = {
  flushed: number
  failed: number
  remaining: number
}

async function flushProduct(item: PublishQueueItem): Promise<void> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...item.payload, confirm_price: true }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
}

async function flushPost(item: PublishQueueItem): Promise<void> {
  const supabase = createClient()
  const content = String(item.payload.content || "").trim()
  if (!content) throw new Error("Post vide")
  const { error } = await supabase.from("posts").insert({
    author_id: item.userId,
    content,
    media_urls: [],
    visibility: "public",
    post_type: "text",
  })
  if (error) throw new Error(error.message)
}

export async function flushPublishQueue(userId?: string): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { flushed: 0, failed: 0, remaining: 0 }
  }

  let uid = userId
  if (!uid) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    uid = user?.id
  }
  if (!uid) return { flushed: 0, failed: 0, remaining: 0 }

  const queue = await listPublishQueue(uid)
  let flushed = 0
  let failed = 0

  for (const item of queue) {
    try {
      if (item.kind === "product") await flushProduct(item)
      else await flushPost(item)
      await removePublishQueueItem(item.id)
      flushed += 1
    } catch (err) {
      failed += 1
      await markPublishAttempt(
        item.id,
        err instanceof Error ? err.message : "sync error",
      )
    }
  }

  const remaining = (await listPublishQueue(uid)).length
  publishQueueCountEvent(remaining)

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("gwa:online-sync", {
        detail: { flushed, failed, remaining },
      }),
    )
  }

  return { flushed, failed, remaining }
}

/** Écoute reconnexion et flush auto (idempotent). */
let listening = false
export function startOfflineSyncListener(): void {
  if (typeof window === "undefined" || listening) return
  listening = true
  const run = () => {
    void flushPublishQueue().catch(() => undefined)
  }
  window.addEventListener("online", run)
  // Premier passage si déjà online + file non vide
  if (navigator.onLine) {
    window.setTimeout(run, 800)
  }
}
