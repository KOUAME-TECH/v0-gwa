#!/usr/bin/env bash
# Applique / rollback migration 065 sur Postgres LOCAL (docker-compose.migration065.yml).
# REFUS explicite de toute URL hébergée (supabase.co / prod).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACTION="${1:-}"
URL="${DATABASE_URL:-postgresql://gwa:gwa_local_only@127.0.0.1:55432/gwa_mig065}"

if [[ ! "$URL" =~ ^postgres(ql)?:// ]]; then
  echo "REFUS: DATABASE_URL doit être postgresql://..." >&2
  exit 2
fi
if [[ "$URL" =~ supabase\.co|mygwa\.org|vercel|neon\.tech|aws\.com ]]; then
  echo "REFUS: URL distante/prod détectée — harness local seulement." >&2
  exit 2
fi
if [[ "$ACTION" != "apply" && "$ACTION" != "rollback" && "$ACTION" != "status" ]]; then
  echo "Usage: $0 apply|rollback|status" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql requis (apt install postgresql-client)" >&2
  exit 1
fi

# Schéma minimal pour que 065 puisse s'appliquer hors dump complet.
bootstrap() {
  psql "$URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT,
  full_name TEXT
);
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID,
  seller_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  escrow_status TEXT,
  total_amount NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  service_fee NUMERIC DEFAULT 0,
  commission_pct NUMERIC DEFAULT 0,
  commission_fcfa NUMERIC DEFAULT 0,
  vendeur_recoit_fcfa NUMERIC,
  feexpay_ref TEXT,
  payout_ref TEXT,
  payout_status TEXT,
  payout_network TEXT,
  payout_at TIMESTAMPTZ,
  payout_error TEXT
);
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  amount_fcfa INTEGER NOT NULL,
  phone TEXT,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
SQL
}

case "$ACTION" in
  apply)
    bootstrap
    psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/schema/065_manual_seller_payouts.sql"
    echo "OK apply 065 (local)"
    ;;
  rollback)
    psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/schema/065_manual_seller_payouts.rollback.sql"
    echo "OK rollback 065 (local)"
    ;;
  status)
    psql "$URL" -c "SELECT to_regclass('public.withdrawal_request_events') AS events, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='provider_reference') AS provider_reference;"
    ;;
esac
