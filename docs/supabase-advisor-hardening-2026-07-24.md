# Supabase Advisor — correctifs 24 juil. 2026

Migration appliquée sur **GWA-DATABASE** : `048_advisor_hardening`  
Fichier repo : `scripts/schema/048_advisor_hardening.sql`

## Corrigé (SQL)

| Alerte Advisor | Action |
|----------------|--------|
| **Auth RLS Initialization Plan** (~104) | `auth.uid()` → `(select auth.uid())` sur toutes les policies `public` |
| **Unindexed foreign keys** (~64) | Indexes `idx_fk_*` sur les colonnes FK |
| **RLS Enabled No Policy** (`digest_runs`) | Policy deny `anon`/`authenticated` |
| **Function Search Path Mutable** | `ALTER FUNCTION … SET search_path = public` sur digest helpers |
| **Public / Signed-In Can Execute SECURITY DEFINER** | `REVOKE` sur triggers sync likes/comments + `user_places_ensure_single_primary` |

## À faire manuellement (Auth Dashboard)

**Leaked Password Protection Disabled** — pas applicable en SQL.

1. Supabase → **Authentication** → **Providers** / **Attack Protection** (ou **Password**)
2. Activer **Leaked password protection** (Have I Been Pwned)
3. Doc : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

L’app affiche déjà un bandeau HIBP côté UI (`HibpPasswordBanner`).

## Non traité volontairement

**Unused Index** : info Advisor seulement. Beaucoup d’indexes viennent d’être créés (FK) et apparaîtront “unused” tant que le trafic est bas. Ne pas les dropper.

## Métriques Observability (contexte)

Sur la fenêtre 14h–15h : CPU ~1 %, connexions ~18, disque DB ~0,03 Go / 8 Go. RAS charge.
