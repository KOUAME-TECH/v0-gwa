// Simulation PGlite de la migration 085 (SCG 5C) sur les colonnes réelles de prod (fixtures/scg_5c_prod_columns.sql).
// Usage : npm i --no-save @electric-sql/pglite && node scripts/schema/tests/085_scg_5c.pglite.mjs
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
const W = new URL("../", import.meta.url).pathname
const db = new PGlite()
const ok = (m) => console.log("OK  ", m)
const ko = (m) => { console.log("FAIL", m); process.exitCode = 1 }
const eq = (label, got, want) => (JSON.stringify(got) === JSON.stringify(want) ? ok(`${label} = ${JSON.stringify(got)}`) : ko(`${label} : ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`))
async function as(role, uid, sql) {
  const claims = JSON.stringify({ role, sub: uid })
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role ${role};`)
  try { return await db.query(sql) } finally { await db.exec("reset role; select set_config('request.jwt.claims', '', false)") }
}
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
`)
await db.exec(readFileSync(W + "tests/fixtures/scg_5c_prod_columns.sql", "utf8"))
await db.exec(`alter table public.scg_scores alter column id set default gen_random_uuid();
grant select, insert on public.scg_scores to service_role, authenticated;`)

const S = "aaaaaaaa-0000-0000-0000-000000000001" // vendeur testé
const B1 = "bbbbbbbb-0000-0000-0000-000000000001", B2 = "bbbbbbbb-0000-0000-0000-000000000002", B3 = "bbbbbbbb-0000-0000-0000-000000000003"
const L = "cccccccc-0000-0000-0000-000000000001" // compte lié (même téléphone)
const P = "dddddddd-0000-0000-0000-000000000001", C = "eeeeeeee-0000-0000-0000-000000000001", CV = "ffffffff-0000-0000-0000-000000000001"
await db.exec(`
insert into public.country_configs(id, country_code, currency, is_active) values (gen_random_uuid(), 'CI', 'XOF', true);
insert into public.profiles(id, email, phone, user_type, country, city, is_verified, phone_verified, created_at, filieres, surface_ha, coordonnees_gps, certif_bio, annee_debut_activite, is_suspended)
values ('${S}', 's@x.ci', '+2250700000001', 'producteur', 'Côte d’Ivoire', 'Daloa', true, true, now() - interval '400 days', array['cacao','cafe'], 3.5, '6.87,-6.45', true, 2015, false),
       ('${B1}', 'b1@x.ci', '+2250700000011', 'acheteur', 'CI', 'Abidjan', false, true, now() - interval '200 days', null, null, null, false, null, false),
       ('${B2}', 'b2@x.ci', '+2250700000012', 'acheteur', 'CI', 'Abidjan', false, true, now() - interval '200 days', null, null, null, false, null, false),
       ('${B3}', 'b3@x.ci', '+2250700000013', 'acheteur', 'CI', 'Abidjan', false, true, now() - interval '200 days', null, null, null, false, null, false),
       ('${L}', 'autre@x.ci', '+2250700000001', 'acheteur', 'CI', 'Daloa', false, true, now() - interval '10 days', null, null, null, false, null, false);
insert into public.cooperatives(id, name, is_verified, validation_status) values ('${C}', 'Coop', true, 'qualified');
insert into public.cooperative_members(id, cooperative_id, user_id, is_active) values (gen_random_uuid(), '${C}', '${S}', true);
insert into public.products(id, seller_id, name, price, prix_unitaire_fcfa, quantite_disponible_kg, status, offer_status, filiere, region, prix_ocpv_ref_fcfa, certifications)
values ('${P}', '${S}', 'Cacao', 1900, 1900, 1000, 'active', 'publiee', 'cacao', 'Haut-Sassandra', 2000, array['rainforest']),
       (gen_random_uuid(), '${S}', 'Brouillon', 1, 1, 999999, 'draft', 'brouillon', 'cacao', null, null, null);
-- 3 ventes livrées à 3 acheteurs (2 mois), 1 auto-achat, 1 vente à un compte lié, 1 vente payée en séquestre, 1 annulée après paiement
insert into public.orders(id, buyer_id, seller_id, status, payment_status, escrow_status, payout_status, total_amount, vendeur_recoit_fcfa, created_at, delivered_at, delivery_deadline) values
 (gen_random_uuid(), '${B1}', '${S}', 'completed', 'paid', 'released', 'released', 100000, 95000, now() - interval '40 days', now() - interval '38 days', now() - interval '37 days'),
 (gen_random_uuid(), '${B2}', '${S}', 'completed', 'paid', 'released', 'released', 200000, 190000, now() - interval '10 days', now() - interval '5 days', now() - interval '7 days'),
 (gen_random_uuid(), '${B3}', '${S}', 'delivered', 'paid', 'held', null, 300000, 285000, now() - interval '9 days', now() - interval '8 days', now() - interval '7 days'),
 (gen_random_uuid(), '${S}', '${S}', 'completed', 'paid', 'released', 'released', 9000000, 9000000, now() - interval '5 days', now() - interval '4 days', null),
 (gen_random_uuid(), '${L}', '${S}', 'completed', 'paid', 'released', 'released', 5000000, 5000000, now() - interval '3 days', now() - interval '2 days', null),
 (gen_random_uuid(), '${B1}', '${S}', 'paid', 'paid', 'held', null, 150000, 142500, now() - interval '1 days', null, null),
 (gen_random_uuid(), '${B2}', '${S}', 'cancelled', 'refunded', 'refunded', null, 50000, 47500, now() - interval '20 days', null, null);
-- avis : 2 vrais (5 et 4), 1 auto-avis (exclu)
insert into public.reviews(id, product_id, seller_id, reviewer_id, rating, comment, review_type) values
 (gen_random_uuid(), '${P}', null, '${B1}', 5, 'top', 'text'),
 (gen_random_uuid(), '${P}', '${S}', '${B2}', 4, 'bien', 'text'),
 (gen_random_uuid(), '${P}', null, '${S}', 5, 'moi', 'text');
-- messages : 2 reçus dont 1 répondu en 30 min
insert into public.conversations(id, participant_1, participant_2) values ('${CV}', '${S}', '${B1}');
insert into public.messages(id, conversation_id, sender_id, content, created_at) values
 (gen_random_uuid(), '${CV}', '${B1}', 'bonjour', now() - interval '3 days'),
 (gen_random_uuid(), '${CV}', '${S}', 'oui', now() - interval '3 days' + interval '30 minutes'),
 (gen_random_uuid(), '${CV}', '${B1}', 'relance', now() - interval '1 days');
insert into public.user_places(id, user_id, place_type, latitude, longitude) values (gen_random_uuid(), '${S}', 'champ', 6.8, -6.4);
insert into public.factoring_requests(id, requester_id, amount_fcfa, status) values (gen_random_uuid(), '${S}', 100000, 'pending');
`)

console.log("— Application 085 (deux fois : idempotence) —")
for (let i = 0; i < 2; i++) await db.exec(readFileSync(W + "085_scg_5c.sql", "utf8"))
ok("085 appliquée deux fois sans erreur")

for (const role of ["authenticated", "anon"]) {
  try { await as(role, S, `select public.scg_5c_inputs('${S}')`); ko(`${role} peut exécuter scg_5c_inputs`) }
  catch (e) { /permission denied/.test(e.message) ? ok(`${role} : EXECUTE refusé`) : ko(e.message) }
}
const j = (await as("service_role", null, `select public.scg_5c_inputs('${S}') j`)).rows[0].j
ok("service_role : exécution OK (" + Object.keys(j).length + " champs)")
eq("kyc_verified", j.kyc_verified, true)
eq("country_supported (« Côte d’Ivoire » → CI)", j.country_supported, true)
eq("self_orders (auto-achat détecté)", j.self_orders, 1)
eq("linked_orders (même téléphone)", j.linked_orders, 1)
eq("orders_completed (hors auto-achat et compte lié)", j.orders_completed, 3)
eq("gmv_12m_fcfa", Number(j.gmv_12m_fcfa), 600000)
eq("distinct_buyers", j.distinct_buyers, 3)
eq("orders_cancelled (après paiement)", j.orders_cancelled, 1)
eq("orders_late (livrée après l'échéance)", j.orders_late, 1)
eq("reviews_count (auto-avis exclu)", j.reviews_count, 2)
eq("reviews_avg", Number(j.reviews_avg), 4.5)
eq("self_reviews", j.self_reviews, 1)
eq("msgs_received / replied", [j.msgs_received, j.msgs_replied_48h], [2, 1])
eq("reply_median_minutes", Number(j.reply_median_minutes), 30)
eq("escrow_held_fcfa (payée, pas encore livrée)", Number(j.escrow_held_fcfa), 150000)
eq("receivables_fcfa (livrée, séquestre non libéré)", Number(j.receivables_fcfa), 285000)
eq("factoring_outstanding_fcfa", Number(j.factoring_outstanding_fcfa), 100000)
eq("stock_value_fcfa (brouillon exclu)", Number(j.stock_value_fcfa), 1900000)
eq("coop_member / coop_verified", [j.coop_member, j.coop_verified], [true, true])
eq("gps_parcels", j.gps_parcels, 2)
eq("certifications (bio + rainforest)", j.certifications, 2)
eq("main_filiere / filieres_count", [j.main_filiere, j.filieres_count], ["cacao", 2])
eq("price_gap_pct", Number(j.price_gap_pct), 5)
eq("activity_start_year", j.activity_start_year, 2015)
const none = (await as("service_role", null, `select public.scg_5c_inputs('99999999-0000-0000-0000-000000000000') j`)).rows[0].j
eq("utilisateur inexistant : exists", none.exists, false)

await as("service_role", null, `insert into public.scg_scores(user_id, score_total, badge, model_version, c_character, c_capacity, c_capital, c_collateral, c_conditions, explain)
  values ('${S}', 612, 'confirme', '5c-v1', 70, 60, 40, 55, 72, '{"top_up":[]}')`)
ok("service_role : insertion d'une ligne 5C")
try { await as("service_role", null, `insert into public.scg_scores(user_id, score_total, badge, c_capacity) values ('${S}', 1, 'x', 101)`); ko("c_capacity 101 accepté") }
catch (e) { /scg_scores_5c_range/.test(e.message) ? ok("sous-score 101 refusé (scg_scores_5c_range)") : ko(e.message) }
eq("ancienne ligne : model_version par défaut", (await db.query(`insert into public.scg_scores(user_id, score_total, badge) values ('${S}', 1, 'x') returning model_version`)).rows[0].model_version, "v1")

console.log("— Rollback 085 puis ré-application —")
await db.exec(readFileSync(W + "085_scg_5c.rollback.sql", "utf8"))
const left = (await db.query(`select count(*)::int n from information_schema.columns where table_name='scg_scores' and column_name in ('c_character','explain','model_version')`)).rows[0].n
const fn = (await db.query(`select count(*)::int n from pg_proc where proname='scg_5c_inputs'`)).rows[0].n
left === 0 && fn === 0 ? ok("rollback : colonnes et fonction supprimées") : ko(`rollback incomplet ${left}/${fn}`)
await db.exec(readFileSync(W + "085_scg_5c.sql", "utf8"))
ok("ré-application après rollback OK")
console.log(process.exitCode ? "ÉCHEC" : "TOUT OK")
