// Simulation PGlite de 083 + 084 sur un schéma qui reproduit les policies, grants et triggers prod (25/11/2026).
// Usage : npm i --no-save @electric-sql/pglite && node scripts/schema/tests/084_scg_write_lockdown.pglite.mjs
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
const W = new URL("../", import.meta.url).pathname
const db = new PGlite()
const ok = (m) => console.log("OK  ", m)
const ko = (m) => { console.log("FAIL", m); process.exitCode = 1 }
async function as(role, uid, sql) {
  const claims = JSON.stringify({ role, sub: uid })
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role ${role};`)
  try { return await db.query(sql) } finally { await db.exec("reset role; select set_config('request.jwt.claims', '', false)") }
}
const U = "11111111-1111-1111-1111-111111111111"
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role' $$;
create table public.profiles(id uuid primary key, full_name text, is_verified boolean default false,
  scg_score integer default 0, scg_badge text default 'debut', scg_bancable boolean default false,
  scg_calculated_at timestamptz, scg_criteria jsonb default '{}'::jsonb);
create table public.scg_scores(id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
  score_total integer, badge text, bancable boolean default false, created_at timestamptz default now());
create table public.scg_history(id uuid primary key default gen_random_uuid(), profile_id uuid references public.profiles(id) on delete cascade,
  score_total integer, badge text, snapshot_date date default current_date, unique(profile_id, snapshot_date));
create table public.factoring_requests(id int, scg_score_snapshot integer);
alter table public.profiles enable row level security; alter table public.scg_scores enable row level security; alter table public.scg_history enable row level security;
create policy profiles_select_all on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update using ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete using ((select auth.uid()) = id);
create policy scg_scores_insert_own on public.scg_scores for insert with check ((select auth.uid()) = user_id);
create policy scg_scores_select_own on public.scg_scores for select using ((select auth.uid()) = user_id);
create policy scg_history_owner on public.scg_history for select using ((select auth.uid()) = profile_id);
grant select, insert, update, delete, truncate, references, trigger on public.scg_scores, public.scg_history to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role; grant select on public.profiles to anon;
grant all on public.factoring_requests to service_role;
create function public.snapshot_scg_daily() returns trigger language plpgsql set search_path to 'public' as $f$
begin insert into public.scg_history (profile_id, score_total, badge, snapshot_date) values (new.user_id, new.score_total, new.badge, current_date)
 on conflict (profile_id, snapshot_date) do update set score_total = excluded.score_total, badge = excluded.badge; return new; end $f$;
create trigger trg_scg_snapshot after insert or update on public.scg_scores for each row execute function public.snapshot_scg_daily();
create function public.protect_profile_privileged_columns() returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role());
begin if jwt_role = 'service_role' then return new; end if;
 new.scg_score := old.scg_score; new.scg_badge := old.scg_badge; new.scg_bancable := old.scg_bancable; new.scg_calculated_at := old.scg_calculated_at; new.is_verified := old.is_verified; return new; end $f$;
create trigger trg_protect_profile_privileged before update on public.profiles for each row execute function public.protect_profile_privileged_columns();
insert into public.profiles(id, full_name) values ('${U}', 'Test');
`)
console.log("— État prod actuel (avant 083/084) —")
try { await as("authenticated", U, `insert into public.scg_scores(user_id, score_total, badge, bancable) values ('${U}', 999, 'excellence', true)`); ko("insert direct scg_scores a réussi") }
catch (e) { ok("insert direct scg_scores échoue déjà (par accident) : " + e.message.slice(0, 70)) }
await as("authenticated", U, `update public.profiles set scg_score = 900, scg_bancable = true where id = '${U}'`)
let r = (await db.query(`select scg_score, scg_bancable from public.profiles where id='${U}'`)).rows[0]
r.scg_score === 0 ? ok("UPDATE profiles.scg_score neutralisé par le trigger") : ko("UPDATE passe : " + JSON.stringify(r))
await as("authenticated", U, `delete from public.profiles where id = '${U}'`)
await as("authenticated", U, `insert into public.profiles(id, full_name, scg_score, scg_bancable, scg_badge) values ('${U}', 'Test', 1000, true, 'excellence')`)
r = (await db.query(`select scg_score, scg_bancable from public.profiles where id='${U}'`)).rows[0]
r.scg_score === 1000 && r.scg_bancable ? ok("FAILLE reproduite : DELETE + INSERT de son profil → scg_score 1000, bancable") : ko("faille non reproduite " + JSON.stringify(r))
await db.query(`update public.profiles set scg_score = 0, scg_bancable = false where id='${U}'`)

console.log("— Application 083 + 084 (deux fois : idempotence) —")
for (let i = 0; i < 2; i++) { await db.exec(readFileSync(W + "083_scg_max_1000.sql", "utf8")); await db.exec(readFileSync(W + "084_scg_write_lockdown.sql", "utf8")) }
ok("083 et 084 appliquées deux fois sans erreur")
try { await as("authenticated", U, `insert into public.scg_scores(user_id, score_total, badge) values ('${U}', 999, 'excellence')`); ko("insert authenticated passe") }
catch (e) { /permission denied/.test(e.message) ? ok("authenticated : INSERT scg_scores → " + e.message.slice(0, 50)) : ko(e.message) }
try { await as("anon", null, `insert into public.scg_history(profile_id, score_total) values ('${U}', 999)`); ko("insert anon passe") }
catch (e) { ok("anon : INSERT scg_history → " + e.message.slice(0, 50)) }
try { await as("authenticated", U, `truncate public.scg_scores`); ko("truncate passe") } catch (e) { ok("authenticated : TRUNCATE refusé") }
const sel = await as("authenticated", U, `select count(*)::int n from public.scg_scores`)
ok("authenticated garde la lecture de ses lignes (n=" + sel.rows[0].n + ")")
await as("authenticated", U, `delete from public.profiles where id = '${U}'`)
await as("authenticated", U, `insert into public.profiles(id, full_name, scg_score, scg_bancable, scg_badge) values ('${U}', 'Test', 1000, true, 'excellence')`)
r = (await db.query(`select scg_score, scg_bancable, scg_badge from public.profiles where id='${U}'`)).rows[0]
r.scg_score === 0 && !r.scg_bancable ? ok("DELETE + INSERT profil : SCG forcé à 0 / non bancable (" + r.scg_badge + ")") : ko("faille ouverte " + JSON.stringify(r))
await as("service_role", null, `insert into public.scg_scores(user_id, score_total, badge, bancable) values ('${U}', 640, 'confirme', true)`)
await as("service_role", null, `update public.profiles set scg_score = 640, scg_bancable = true where id = '${U}'`)
r = (await db.query(`select p.scg_score, p.scg_bancable, (select count(*)::int from public.scg_history h where h.profile_id=p.id) h from public.profiles p where id='${U}'`)).rows[0]
r.scg_score === 640 && r.h === 1 ? ok("service role : écrit scg_scores (+ scg_history par trigger) et profiles.scg_score") : ko(JSON.stringify(r))
await as("service_role", null, `insert into public.profiles(id, full_name, scg_score) values ('22222222-2222-2222-2222-222222222222', 'S', 300)`)
r = (await db.query(`select scg_score from public.profiles where id='22222222-2222-2222-2222-222222222222'`)).rows[0]
r.scg_score === 300 ? ok("service role : INSERT profil avec SCG conservé") : ko(JSON.stringify(r))
try { await as("service_role", null, `update public.profiles set scg_score = 1001 where id = '${U}'`); ko("1001 accepté") } catch (e) { ok("083 : 1001 refusé même pour la service role") }

console.log("— Rollback 084 —")
await db.exec(readFileSync(W + "084_scg_write_lockdown.rollback.sql", "utf8"))
const pol = (await db.query(`select policyname from pg_policies where tablename='scg_scores' order by 1`)).rows.map((x) => x.policyname)
const trg = (await db.query(`select count(*)::int n from pg_trigger where tgname='trg_protect_profile_scg_insert'`)).rows[0].n
pol.includes("scg_scores_insert_own") && trg === 0 ? ok("rollback : policy rétablie, trigger supprimé") : ko(JSON.stringify({ pol, trg }))
await db.exec(readFileSync(W + "084_scg_write_lockdown.sql", "utf8")); ok("ré-application après rollback")
