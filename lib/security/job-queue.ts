/**
 * File d’attente légère via Upstash Redis (Mission D — backend scalable).
 * Jobs audio / IA / PDF : push LPUSH + consommateur cron ultérieur.
 * Sans Upstash : no-op mémoire (dev only, non durable).
 */

import { Redis } from "@upstash/redis"
import { hasUpstash } from "@/lib/security/upstash"

export type ChatJobKind = "audio_process" | "ai_advice" | "pdf_order"

export type ChatJob = {
  id: string
  kind: ChatJobKind
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
}

const memoryQueues = new Map<string, ChatJob[]>()

function getRedis(): Redis | null {
  if (!hasUpstash()) return null
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function queueKey(kind: ChatJobKind): string {
  return `gwa:queue:${kind}`
}

export async function enqueueChatJob(
  kind: ChatJobKind,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; id: string; backend: "upstash" | "memory" }> {
  const job: ChatJob = {
    id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  }
  const redis = getRedis()
  if (redis) {
    await redis.lpush(queueKey(kind), JSON.stringify(job))
    return { ok: true, id: job.id, backend: "upstash" }
  }
  const list = memoryQueues.get(kind) || []
  list.push(job)
  memoryQueues.set(kind, list)
  return { ok: true, id: job.id, backend: "memory" }
}

export async function dequeueChatJob(
  kind: ChatJobKind,
): Promise<ChatJob | null> {
  const redis = getRedis()
  if (redis) {
    const raw = await redis.rpop<string>(queueKey(kind))
    if (!raw) return null
    try {
      return typeof raw === "string" ? (JSON.parse(raw) as ChatJob) : (raw as ChatJob)
    } catch {
      return null
    }
  }
  const list = memoryQueues.get(kind) || []
  const job = list.shift() || null
  memoryQueues.set(kind, list)
  return job
}

export async function chatQueueDepth(kind: ChatJobKind): Promise<number> {
  const redis = getRedis()
  if (redis) {
    const n = await redis.llen(queueKey(kind))
    return typeof n === "number" ? n : 0
  }
  return (memoryQueues.get(kind) || []).length
}
