import "server-only"
import { resolvePlatformSecret } from "@/lib/ops/platform-secrets"

export type GeniusPayCredentials = {
  apiKey: string
  apiSecret: string
}

export async function resolveGeniusPayCredentials(): Promise<GeniusPayCredentials | null> {
  const apiKey =
    (process.env.GENIUSPAY_API_KEY || "").trim() ||
    (await resolvePlatformSecret("GENIUSPAY_API_KEY"))
  const apiSecret =
    (process.env.GENIUSPAY_API_SECRET || "").trim() ||
    (await resolvePlatformSecret("GENIUSPAY_API_SECRET"))
  return apiKey && apiSecret ? { apiKey, apiSecret } : null
}
