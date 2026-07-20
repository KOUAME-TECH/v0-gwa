import { Redis } from "@upstash/redis"

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

export function hasUpstash(): boolean {
  return !!(
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL
  ) && !!(
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

/**
 * Incrémente un compteur fenêtré. Retourne le count actuel.
 */
export async function upstashIncr(
  key: string,
  windowMs: number,
): Promise<number | null> {
  const client = getRedis()
  if (!client) return null
  const count = await client.incr(key)
  if (count === 1) {
    await client.pexpire(key, windowMs)
  }
  return count
}

export async function upstashGetBlocked(key: string): Promise<number | null> {
  const client = getRedis()
  if (!client) return null
  const val = await client.get<number | string>(key)
  if (val == null) return null
  return typeof val === "number" ? val : Number(val)
}

export async function upstashSetBlocked(
  key: string,
  untilMs: number,
  ttlMs: number,
): Promise<void> {
  const client = getRedis()
  if (!client) return
  await client.set(key, untilMs, { px: ttlMs })
}
