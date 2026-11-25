// Simulation PGlite de 086 sur les colonnes réelles de profiles / verification_requests (prod, 25/11/2026),
// avec les policies, droits et triggers prod (protect_profile_privileged_columns, calc_profile_completion) + 084.
// Usage : npm i --no-save @electric-sql/pglite && node scripts/schema/tests/086_profile_privileged_fields_lockdown.pglite.mjs
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
const W = new URL("../", import.meta.url).pathname
const db = new PGlite()
const ok = (m) => console.log("OK  ", m)
const ko = (m) => { console.log("FAIL", m); process.exitCode = 1 }
const eq = (label, got, want) => (JSON.stringify(got) === JSON.stringify(want) ? ok(`${label}`) : ko(`${label} : ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`))
async function as(role, uid, sql) {
  if (role === null) { return db.query(sql) } // contexte interne sans JWT (Supabase Auth, cron)
  const claims = JSON.stringify({ role, sub: uid })
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role ${role};`)
  try { return await db.query(sql) } finally { await db.exec("reset role; select set_config('request.jwt.claims', '', false)") }
}
const U = "11111111-1111-1111-1111-111111111111"
const prof = async (cols) => (await db.query(`select ${cols} from public.profiles where id='${U}'`)).rows[0]

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role' $$;
`)
// Colonnes prod (types), puis valeurs par défaut prod
const fixture = readFileSync(W + "tests/fixtures/scg_5c_prod_columns.sql", "utf8")
for (const t of ["profiles", "verification_requests", "scg_scores"]) {
  const m = fixture.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))
  await db.exec(m[0])
}
await db.exec(`
alter table public.profiles
  alter column is_verified set default false, alter column rating set default 0, alter column total_reviews set default 0,
  alter column created_at set default now(), alter column updated_at set default now(), alter column is_suspended set default false,
  alter column scg_criteria set default '{"kyc": 0, "network": 0, "quality": 0, "reviews": 0, "activity": 0, "transactions": 0}'::jsonb,
  alter column scg_score set default 0, alter column scg_badge set default 'debut', alter column scg_bancable set default false,
  alter column profile_completion_pct set default 0, alter column rccm_verified set default false,
  alter column subscription_tier set default 'free', alter column phone_verified set default false,
  alter column notify_push set default true, alter column notify_sms set default true;
alter table public.verification_requests alter column id set default gen_random_uuid(), alter column status set default 'pending';
alter table public.scg_scores alter column id set default gen_random_uuid();
create table public.scg_history(id uuid primary key default gen_random_uuid(), profile_id uuid, score_total integer, badge text, snapshot_date date default current_date);
create table public.factoring_requests(id int, scg_score_snapshot integer);
alter table public.profiles enable row level security; alter table public.verification_requests enable row level security;
create policy profiles_select_all on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update using ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete using ((select auth.uid()) = id);
create policy verification_insert on public.verification_requests for insert with check ((select auth.uid()) = user_id);
create policy verification_select on public.verification_requests for select using ((select auth.uid()) = user_id);
grant select on public.profiles to anon;
grant select, insert, update, delete, truncate, references, trigger on public.profiles to authenticated;
grant all on public.profiles, public.verification_requests, public.scg_scores, public.scg_history to service_role;
grant select, insert on public.verification_requests to authenticated;
`)
// Triggers prod actuels (copie conforme)
const prodJson = JSON.parse(readFileSync(new URL("./fixtures/profiles_triggers_prod.json", import.meta.url), "utf8"))
await db.exec(prodJson.protect_profile_privileged_columns + ";")
await db.exec(prodJson.calc_profile_completion + ";")
await db.exec(`
create trigger trg_profile_completion before insert or update on public.profiles for each row execute function calc_profile_completion();
create trigger trg_protect_profile_privileged before update on public.profiles for each row execute function protect_profile_privileged_columns();
`)
// Inscription : handle_new_user (Supabase Auth, sans JWT)
await as(null, null, `insert into public.profiles(id, email, full_name, user_type) values ('${U}', 'u@x.ci', 'Awa', 'producteur')`)

console.log("— Prod actuelle (avant 086) —")
await as("authenticated", U, `update public.profiles set subscription_expires_at = '2099-01-01', phone_linked_at = now() where id = '${U}'`)
let r = await prof("subscription_expires_at is not null s, phone_linked_at is not null p")
r.s && r.p ? ok("FAILLE : UPDATE subscription_expires_at / phone_linked_at passe aujourd'hui") : ko("non reproduit " + JSON.stringify(r))
await as("authenticated", U, `delete from public.profiles where id = '${U}'`)
await as("authenticated", U, `insert into public.profiles(id, full_name, user_type, is_verified, subscription_tier, is_suspended, phone, phone_verified, rating, coop_id)
  values ('${U}', 'Awa', 'cooperative', true, 'pro', false, '+2250700000000', true, 5, gen_random_uuid())`)
r = await prof("is_verified, subscription_tier, user_type, phone_verified")
r.is_verified && r.subscription_tier === "pro" && r.user_type === "cooperative" ? ok("FAILLE : supprimer puis recréer → is_verified, pro, cooperative") : ko("non reproduit " + JSON.stringify(r))
await as("authenticated", U, `insert into public.verification_requests(user_id, request_type, status) values ('${U}', 'user', 'approved')`)
r = (await db.query(`select status from public.verification_requests`)).rows[0]
r.status === "approved" ? ok("FAILLE : un membre crée sa propre demande KYC « approved »") : ko(JSON.stringify(r))
await db.exec(`delete from public.verification_requests; delete from public.profiles;`)
await as(null, null, `insert into public.profiles(id, email, full_name, user_type) values ('${U}', 'u@x.ci', 'Awa', 'producteur')`)

console.log("— Application 084 puis 086 (086 deux fois : idempotence) —")
await db.exec(readFileSync(W + "084_scg_write_lockdown.sql", "utf8"))
for (let i = 0; i < 2; i++) await db.exec(readFileSync(W + "086_profile_privileged_fields_lockdown.sql", "utf8"))
ok("084 + 086 appliquées")
const trg = (await db.query(`select string_agg(tgname, ',' order by tgname) t from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal`)).rows[0].t
eq("triggers profiles = protection unique + complétion", trg, "trg_0_protect_profile_privileged,trg_profile_completion")

// UPDATE membre : privilégiés figés, le reste passe
const priv = {
  user_type: "'cooperative'", sub_type: "'cooperative'", coop_id: "gen_random_uuid()", is_verified: "true", rccm_verified: "true",
  phone: "'+2250799999999'", phone_verified: "true", phone_linked_at: "now()", email_linked_at: "now()",
  is_suspended: "true", suspended_reason: "'x'", suspended_at: "now()", suspended_by: "gen_random_uuid()",
  subscription_tier: "'pro'", subscription_expires_at: "'2099-01-01'", pricing_plan_id: "gen_random_uuid()",
  rating: "5", total_reviews: "99", scg_score: "1000", scg_badge: "'excellence'", scg_bancable: "true",
  scg_calculated_at: "now()", scg_criteria: "'{}'::jsonb", created_at: "'2000-01-01'", digest_last_sent_at: "now()",
}
const fields = Object.keys(priv)
const listed = readFileSync(new URL("../../../lib/profile/privileged.ts", import.meta.url), "utf8")
const missing = fields.filter((f) => !listed.includes(`"${f}"`))
missing.length ? ko("lib/profile/privileged.ts ne liste pas : " + missing) : ok("liste TS identique aux " + fields.length + " champs SQL")

const before = await prof(fields.join(", "))
await as("authenticated", U, `update public.profiles set ${fields.map((f) => `${f} = ${priv[f]}`).join(", ")},
  full_name = 'Awa K.', bio = 'Productrice de cacao à Daloa', city = 'Daloa', latitude = 6.8, longitude = -6.4,
  onboarding_completed_at = now(), linked_email = 'awa@x.ci', filieres = array['cacao'], surface_ha = 3 where id = '${U}'`)
const after = await prof(fields.join(", ") + ", full_name, city, latitude, onboarding_completed_at is not null onb, linked_email, filieres, surface_ha::float s")
const changed = fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]))
changed.length ? ko("UPDATE membre a modifié : " + changed) : ok(`UPDATE membre : ${fields.length} champs privilégiés inchangés`)
eq("UPDATE membre : édition du profil (nom, ville, GPS, onboarding, email lié, filières, surface) OK",
  [after.full_name, after.city, after.latitude, after.onb, after.linked_email, after.filieres, after.s],
  ["Awa K.", "Daloa", 6.8, true, "awa@x.ci", ["cacao"], 3])

// Supprimer puis recréer
await as("authenticated", U, `delete from public.profiles where id = '${U}'`)
await as("authenticated", U, `insert into public.profiles(id, full_name, city, ${fields.join(", ")}) values ('${U}', 'Awa', 'Daloa', ${fields.map((f) => priv[f]).join(", ")})`)
r = await prof("full_name, city, user_type, sub_type, coop_id, is_verified, rccm_verified, phone, phone_verified, is_suspended, subscription_tier, subscription_expires_at, pricing_plan_id, rating::float, total_reviews, scg_score, scg_badge, scg_bancable, created_at > now() - interval '1 minute' fresh, digest_last_sent_at, profile_completion_pct")
eq("INSERT membre (supprimer puis recréer) : tous les champs privilégiés aux valeurs par défaut", r, {
  full_name: "Awa", city: "Daloa", user_type: null, sub_type: null, coop_id: null, is_verified: false, rccm_verified: false, phone: null,
  phone_verified: false, is_suspended: false, subscription_tier: "free", subscription_expires_at: null, pricing_plan_id: null, rating: 0,
  total_reviews: 0, scg_score: 0, scg_badge: "debut", scg_bancable: false, fresh: true, digest_last_sent_at: null, profile_completion_pct: 15,
})
ok("complétion calculée sur les valeurs protégées (téléphone forgé non compté)")

// Serveur (service role) : rôle, OTP, KYC, abonnement
await as("service_role", null, `update public.profiles set user_type = 'producteur', sub_type = 'producteur_individuel', phone = '+2250700000000',
  phone_verified = true, is_verified = true, subscription_tier = 'pro', scg_score = 640 where id = '${U}'`)
r = await prof("user_type, sub_type, phone_verified, is_verified, subscription_tier, scg_score")
eq("service role : onboarding (rôle), OTP (téléphone), KYC, abonnement, SCG écrits", r,
  { user_type: "producteur", sub_type: "producteur_individuel", phone_verified: true, is_verified: true, subscription_tier: "pro", scg_score: 640 })

// Inscription par Supabase Auth (handle_new_user, sans JWT)
const U2 = "22222222-2222-2222-2222-222222222222"
await as(null, null, `insert into public.profiles(id, email, full_name, user_type) values ('${U2}', 'b@x.ci', 'Bintou', 'acheteur')`)
eq("inscription (handle_new_user) : user_type conservé", (await db.query(`select user_type from public.profiles where id='${U2}'`)).rows[0].user_type, "acheteur")

// KYC
await as("authenticated", U, `insert into public.verification_requests(user_id, request_type, status, reviewed_at, notes) values ('${U}', 'user', 'approved', now(), 'ok')`)
eq("KYC : demande créée par le membre forcée à pending", (await db.query(`select status, reviewed_at, notes from public.verification_requests`)).rows[0], { status: "pending", reviewed_at: null, notes: null })
await as("service_role", null, `update public.verification_requests set status = 'approved' where user_id = '${U}'`)
eq("KYC : approbation serveur OK", (await db.query(`select status from public.verification_requests`)).rows[0].status, "approved")

try { await as("authenticated", U, `truncate public.profiles`); ko("TRUNCATE profiles passe") } catch { ok("authenticated : TRUNCATE profiles refusé") }
try { await as("authenticated", U, `select public.protect_profile_privileged_fields()`); ko("fonction appelable") } catch { ok("fonction de protection non appelable par un membre") }

console.log("— Rollback 086 puis ré-application —")
await db.exec(readFileSync(W + "086_profile_privileged_fields_lockdown.rollback.sql", "utf8"))
eq("rollback : triggers d'avant 086 (prod + 084)",
  (await db.query(`select string_agg(tgname, ',' order by tgname) t from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal`)).rows[0].t,
  "trg_profile_completion,trg_protect_profile_privileged,trg_protect_profile_scg_insert")
await db.exec(readFileSync(W + "086_profile_privileged_fields_lockdown.sql", "utf8"))
ok("ré-application après rollback OK")
console.log(process.exitCode ? "ÉCHEC" : "TOUT OK")
