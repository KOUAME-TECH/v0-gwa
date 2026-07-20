import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"
import {
  digestSinceHours,
  filterDigestProducts,
  type DigestProduct,
  type DigestProfile,
} from "@/lib/products/digest"

export type DigestRunResult = {
  usersProcessed: number
  pushesSent: number
  skippedNoProducts: number
  skippedOptOut: number
  errors: number
}

const PRODUCT_SELECT =
  "id, name, price, unit, description, audio_url, origin_region, origin_country, region, ville, created_at, product_type, is_organic, audio_lang"

function buildDigestUrl(since: Date, productIds: string[]): string {
  const params = new URLSearchParams({
    digest: "1",
    since: since.toISOString(),
    ids: productIds.slice(0, 10).join(","),
  })
  return `/marketplace?${params.toString()}`
}

/** Envoie le digest quotidien à tous les utilisateurs éligibles. */
export async function runHarmattanDigest(): Promise<DigestRunResult> {
  const admin = createAdminClient()
  const since = digestSinceHours(24)
  const result: DigestRunResult = {
    usersProcessed: 0,
    pushesSent: 0,
    skippedNoProducts: 0,
    skippedOptOut: 0,
    errors: 0,
  }

  const { data: products, error: productsError } = await admin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(200)

  if (productsError) {
    throw new Error(productsError.message)
  }

  const recentProducts = (products ?? []) as DigestProduct[]
  if (recentProducts.length === 0) {
    return result
  }

  const profileSelect =
    "id, city, country, onesignal_player_id, digest_enabled, digest_last_sent_at"
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(profileSelect)
    .not("city", "is", null)

  if (profilesError) {
    // Colonnes digest absentes — fallback sans digest_enabled
    const { data: fallbackProfiles, error: fallbackError } = await admin
      .from("profiles")
      .select("id, city, country, onesignal_player_id")
      .not("city", "is", null)

    if (fallbackError) throw new Error(fallbackError.message)

    for (const raw of fallbackProfiles ?? []) {
      await sendDigestToUser(admin, raw as DigestProfile, recentProducts, since, result, true)
    }
    return result
  }

  for (const raw of profiles ?? []) {
    const profile = raw as DigestProfile & { digest_enabled?: boolean | null }
    if (profile.digest_enabled === false) {
      result.skippedOptOut++
      continue
    }
    await sendDigestToUser(admin, profile, recentProducts, since, result, false)
  }

  return result
}

async function sendDigestToUser(
  admin: ReturnType<typeof createAdminClient>,
  profile: DigestProfile,
  allProducts: DigestProduct[],
  since: Date,
  result: DigestRunResult,
  skipLastSentUpdate: boolean,
) {
  result.usersProcessed++

  const matched = filterDigestProducts(allProducts, profile, since)
  if (matched.length === 0) {
    result.skippedNoProducts++
    return
  }

  const cityLabel = profile.city?.trim() || profile.country?.trim() || "chez vous"
  const count = matched.length
  const title = `Harmattan Digest — ${cityLabel}`
  const body =
    count === 1
      ? "1 nouveau produit près de chez vous"
      : `${count} nouveaux produits près de chez vous`
  const url = buildDigestUrl(since, matched.map((p) => p.id))

  try {
    await admin.from("notifications").insert({
      user_id: profile.id,
      type: "digest",
      title,
      message: body,
      body,
      link: url,
      is_read: false,
      read: false,
    })

    const push = await sendPushToUser(admin as never, profile.id, {
      title,
      body,
      url,
      data: { type: "harmattan_digest", product_ids: matched.map((p) => p.id), since: since.toISOString() },
    })

    if (push.success) {
      result.pushesSent++
      if (!skipLastSentUpdate) {
        await admin
          .from("profiles")
          .update({ digest_last_sent_at: new Date().toISOString() })
          .eq("id", profile.id)
      }
    } else {
      result.errors++
    }
  } catch (err) {
    console.error("[harmattan-digest] user", profile.id, err)
    result.errors++
  }
}
