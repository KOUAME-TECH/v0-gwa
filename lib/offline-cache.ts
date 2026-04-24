// GWA Offline Cache - Per spec: "Tous les flux critiques fonctionnent sans connexion 30+ minutes"
// Uses IndexedDB for structured data and localStorage for quick access

const CACHE_PREFIX = "gwa_cache_"
const CACHE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

interface CachedItem<T> {
  data: T
  timestamp: number
  version: number
}

// Simple in-memory fallback
const memoryCache = new Map<string, CachedItem<any>>()

// Check if IndexedDB is available
const isIndexedDBAvailable = () => {
  if (typeof window === "undefined") return false
  try {
    return "indexedDB" in window && window.indexedDB !== null
  } catch {
    return false
  }
}

// IndexedDB wrapper
class GWAOfflineDB {
  private dbName = "gwa_offline_db"
  private storeName = "cache_store"
  private db: IDBDatabase | null = null
  private ready: Promise<boolean>

  constructor() {
    this.ready = this.init()
  }

  private async init(): Promise<boolean> {
    if (!isIndexedDBAvailable()) return false

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, 1)

        request.onerror = () => resolve(false)

        request.onsuccess = () => {
          this.db = request.result
          resolve(true)
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: "key" })
          }
        }
      } catch {
        resolve(false)
      }
    })
  }

  async set<T>(key: string, data: T, version = 1): Promise<void> {
    const item: CachedItem<T> & { key: string } = {
      key: `${CACHE_PREFIX}${key}`,
      data,
      timestamp: Date.now(),
      version,
    }

    // Always set in memory cache
    memoryCache.set(key, item)

    // Try localStorage for critical data
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(item))
    } catch {
      // localStorage might be full or unavailable
    }

    // Try IndexedDB
    const isReady = await this.ready
    if (!isReady || !this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)
        store.put(item)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${CACHE_PREFIX}${key}`

    // Check memory cache first (fastest)
    const memItem = memoryCache.get(key)
    if (memItem && Date.now() - memItem.timestamp < CACHE_EXPIRY_MS) {
      return memItem.data as T
    }

    // Check localStorage (fast, synchronous)
    try {
      const localItem = localStorage.getItem(fullKey)
      if (localItem) {
        const parsed = JSON.parse(localItem) as CachedItem<T>
        if (Date.now() - parsed.timestamp < CACHE_EXPIRY_MS) {
          memoryCache.set(key, parsed) // Populate memory cache
          return parsed.data
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Check IndexedDB (slower but more reliable)
    const isReady = await this.ready
    if (!isReady || !this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readonly")
        const store = transaction.objectStore(this.storeName)
        const request = store.get(fullKey)

        request.onsuccess = () => {
          const item = request.result as CachedItem<T> | undefined
          if (item && Date.now() - item.timestamp < CACHE_EXPIRY_MS) {
            memoryCache.set(key, item)
            resolve(item.data)
          } else {
            resolve(null)
          }
        }

        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async delete(key: string): Promise<void> {
    const fullKey = `${CACHE_PREFIX}${key}`

    memoryCache.delete(key)

    try {
      localStorage.removeItem(fullKey)
    } catch {
      // Ignore
    }

    const isReady = await this.ready
    if (!isReady || !this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)
        store.delete(fullKey)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    memoryCache.clear()

    // Clear localStorage GWA cache
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      // Ignore
    }

    const isReady = await this.ready
    if (!isReady || !this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)
        store.clear()
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}

// Singleton instance
export const offlineCache = new GWAOfflineDB()

// Convenience functions
export async function cacheData<T>(key: string, data: T): Promise<void> {
  return offlineCache.set(key, data)
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  return offlineCache.get<T>(key)
}

export async function clearCache(): Promise<void> {
  return offlineCache.clear()
}

// Cache keys for different data types
export const CACHE_KEYS = {
  USER_PROFILE: "user_profile",
  USER_PRODUCTS: "user_products",
  USER_ORDERS: "user_orders",
  FEED_ITEMS: "feed_items",
  CONVERSATIONS: "conversations",
  MESSAGES: (conversationId: string) => `messages_${conversationId}`,
  PRODUCT_DETAILS: (productId: string) => `product_${productId}`,
  CATEGORIES: "categories",
  NOTIFICATIONS: "notifications",
  WALLET_BALANCE: "wallet_balance",
  SCG_SCORE: "scg_score",
} as const

// Hook for offline-aware data fetching
export function withOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; forceRefresh?: boolean } = {}
): () => Promise<{ data: T | null; isOffline: boolean; fromCache: boolean }> {
  return async () => {
    const { forceRefresh = false } = options

    // Check if online
    const isOnline =
      typeof navigator !== "undefined" ? navigator.onLine : true

    // Try cache first if offline or not forcing refresh
    if (!isOnline || !forceRefresh) {
      const cached = await getCachedData<T>(key)
      if (cached) {
        return { data: cached, isOffline: !isOnline, fromCache: true }
      }
    }

    // If offline and no cache, return null
    if (!isOnline) {
      return { data: null, isOffline: true, fromCache: false }
    }

    // Fetch fresh data
    try {
      const data = await fetcher()
      await cacheData(key, data)
      return { data, isOffline: false, fromCache: false }
    } catch {
      // On error, try cache as fallback
      const cached = await getCachedData<T>(key)
      return { data: cached, isOffline: false, fromCache: cached !== null }
    }
  }
}
