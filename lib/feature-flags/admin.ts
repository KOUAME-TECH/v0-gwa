import { z } from "zod"
import { KNOWN_FEATURE_FLAGS } from "@/lib/feature-flags/core"

/** Corps de PATCH /api/admin/features (GSAC-3). Clés inconnues refusées. */
export const featureFlagPatchSchema = z
  .object({
    name: z.enum(KNOWN_FEATURE_FLAGS),
    is_active_public: z.boolean().optional(),
    is_active_beta: z.boolean().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine((v) => v.is_active_public !== undefined || v.is_active_beta !== undefined, {
    message: "is_active_public ou is_active_beta requis",
  })

export type FeatureFlagPatch = z.infer<typeof featureFlagPatchSchema>

export type FeatureFlagRow = {
  name: string
  is_active_public: boolean
  is_active_beta: boolean
  description: string | null
  updated_at?: string | null
  updated_by?: string | null
}

/** Colonnes 082 absentes (migration non appliquée) : PostgREST 42703 / PGRST204. */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message || "")
}
