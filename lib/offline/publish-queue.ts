/**
 * File d’attente publication offline (texte d’abord).
 * Médias : publication uniquement en ligne (trop lourd pour IDB v1).
 */

const DB_NAME = "gwa_offline_outbox"
const DB_VERSION = 1
const STORE = "queue"

export type PublishQueueKind = "product" | "post"

export type PublishQueueItem = {
  id: string
  kind: PublishQueueKind
  userId: string
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" })
        store.createIndex("by_user", "userId", { unique: false })
      }
    }
  })
}

function newId() {
  return `pq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function enqueuePublish(
  userId: string,
  kind: PublishQueueKind,
  payload: Record<string, unknown>,
): Promise<PublishQueueItem> {
  const db = await openDb()
  const item: PublishQueueItem = {
    id: newId(),
    kind,
    userId,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return item
}

export async function listPublishQueue(userId?: string): Promise<PublishQueueItem[]> {
  if (typeof indexedDB === "undefined") return []
  const db = await openDb()
  const rows = await new Promise<PublishQueueItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as PublishQueueItem[]) || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  const list = userId ? rows.filter((r) => r.userId === userId) : rows
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function removePublishQueueItem(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function markPublishAttempt(id: string, error?: string): Promise<void> {
  const db = await openDb()
  const existing = await new Promise<PublishQueueItem | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as PublishQueueItem | undefined)
    req.onerror = () => reject(req.error)
  })
  if (!existing) {
    db.close()
    return
  }
  const next: PublishQueueItem = {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(next)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export function publishQueueCountEvent(count: number) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("gwa:publish-queue", { detail: { count } }),
  )
}
