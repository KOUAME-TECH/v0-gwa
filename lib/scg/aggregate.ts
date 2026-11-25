import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ScgInputs } from "@/lib/scg/five-c"

/**
 * Collecte des données SCG 5C d'un utilisateur — côté serveur uniquement.
 * Une seule requête : public.scg_5c_inputs(uuid) (migration 085, SECURITY DEFINER,
 * exécutable par service_role seulement). Lecture seule.
 */
export async function aggregateProducerData(
  userId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<ScgInputs> {
  const { data, error } = await admin.rpc("scg_5c_inputs", { p_user: userId })
  if (error) throw new Error(`scg_5c_inputs: ${error.message}`)
  const inputs = (data ?? {}) as ScgInputs
  return { ...inputs, user_id: userId }
}
