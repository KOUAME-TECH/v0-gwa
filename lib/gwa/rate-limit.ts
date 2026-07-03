// GWA Platform — Rate limiting via Upstash Redis
// Protection API routes : OTP (5/h), commandes (20/min), général (60/min)

import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url   = process.env.KV_REST_API_URL
    const token = process.env.KV_REST_API_TOKEN

    if (!url || !token) {
      throw new Error(
        'Upstash Redis non configuré. Variables manquantes : KV_REST_API_URL, KV_REST_API_TOKEN.'
      )
    }
    redis = new Redis({ url, token })
  }
  return redis
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number   // timestamp Unix en secondes
  limit: number
}

/**
 * Vérifie et incrémente le compteur de rate limiting
 * @param key - Clé unique (ex: "otp:+22507XXXXXXXX")
 * @param limit - Nombre de requêtes max par fenêtre
 * @param windowSeconds - Durée de la fenêtre en secondes
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const r = getRedis()
  const fullKey = `gwa:rl:${key}`

  const [count] = await r.pipeline()
    .incr(fullKey)
    .expire(fullKey, windowSeconds)
    .exec() as [number, number]

  const ttl    = await r.ttl(fullKey)
  const reset  = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds)

  return {
    success:   count <= limit,
    remaining: Math.max(0, limit - count),
    reset,
    limit,
  }
}

// Présets de rate limits
export const RATE_LIMITS = {
  otp_send:          { limit: 5,   window: 3600  },  // 5 tentatives/heure par téléphone
  otp_verify:        { limit: 10,  window: 600   },  // 10 essais OTP / 10 min
  auth_generic:      { limit: 20,  window: 60    },  // 20 req/min auth
  api_generic:       { limit: 60,  window: 60    },  // 60 req/min API
  product_create:    { limit: 10,  window: 3600  },  // 10 publications/heure
  order_create:      { limit: 20,  window: 3600  },  // 20 commandes/heure
  upload:            { limit: 30,  window: 3600  },  // 30 uploads/heure
} as const

/**
 * Middleware helper : retourne une Response 429 si rate limit dépassé
 */
export async function enforceRateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMITS
): Promise<Response | null> {
  const { limit, window } = RATE_LIMITS[preset]
  const result = await checkRateLimit(identifier, limit, window)

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Trop de requêtes. Réessayez plus tard.',
        retry_after: result.reset - Math.floor(Date.now() / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type':     'application/json',
          'X-RateLimit-Limit':     String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset':     String(result.reset),
          'Retry-After':           String(result.reset - Math.floor(Date.now() / 1000)),
        },
      }
    )
  }

  return null // pas de blocage
}
