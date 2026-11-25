// Génère la requête SQL de dry-run 5C (LECTURE SEULE) à partir du corps exact de
// public.scg_5c_inputs (085), sans créer la fonction : p_user → u.id, une ligne par profil.
// Sortie anonyme : rang, type de compte, score actuel, entrées 5C (sans id, nom, téléphone ni email).
// Usage : node scripts/scg/dry-run-5c.sql.mjs > /tmp/dry-run.sql  (à exécuter en lecture seule)
import { readFileSync } from "node:fs"

const sql = readFileSync(new URL("../schema/085_scg_5c.sql", import.meta.url), "utf8")
const start = sql.indexOf("AS $fn$") + "AS $fn$".length
const end = sql.indexOf("$fn$;", start)
const body = sql.slice(start, end).trim().replace(/;\s*$/, "").replace(/\bp_user\b/g, "u.id")

export const dryRunSql = `SELECT
  'U' || lpad(row_number() OVER (ORDER BY u.created_at)::text, 2, '0') AS anon,
  u.user_type,
  (SELECT s.score_total FROM public.scg_scores s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1) AS before_score,
  u.scg_score AS profile_score,
  ((${body}) - 'user_id') AS inputs
FROM public.profiles u
ORDER BY u.created_at`

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  process.stdout.write(dryRunSql + ";\n")
}
