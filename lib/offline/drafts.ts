/** Brouillons offline — IndexedDB (produits / posts). */

const DB_NAME = "gwa_offline_drafts"
const DB_VERSION = 1
const STORE = "drafts"

export type DraftKind = "product" | "post"

export type OfflineDraft<T = Record<string, unknown>> = {
  id: string
  kind: DraftKind
  userId: string
  payload: T
  updatedAt: string
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
        store.createIndex("by_user_kind", ["userId", "kind"], { unique: false })
      }
    }
  })
}

function draftId(userId: string, kind: DraftKind) {
  return `${kind}:${userId}`
}

export async function saveOfflineDraft<T extends Record<string, unknown>>(
  userId: string,
  kind: DraftKind,
  payload: T,
): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  const row: OfflineDraft<T> = {
    id: draftId(userId, kind),
    kind,
    userId,
    payload,
    updatedAt: new Date().toISOString(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadOfflineDraft<T = Record<string, unknown>>(
  userId: string,
  kind: DraftKind,
): Promise<OfflineDraft<T> | null> {
  if (typeof indexedDB === "undefined") return null
  const db = await openDb()
  const row = await new Promise<OfflineDraft<T> | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(draftId(userId, kind))
    req.onsuccess = () => resolve(req.result as OfflineDraft<T> | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return row ?? null
}

export async function clearOfflineDraft(userId: string, kind: DraftKind): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(draftId(userId, kind))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
