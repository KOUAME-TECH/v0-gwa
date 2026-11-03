# Issue 1 — `orders.currency` schema-cache fix

## Root cause

Chat offer validation (`POST /api/orders/from-offer`) and `POST /api/orders` insert `currency: "XOF"`.
PostgREST returned:

> Could not find the 'currency' column of 'orders' in the schema cache

Live `public.orders` was missing `currency`. Repo migration `scripts/schema/058_order_currency.sql` existed but had **never been applied** on GWA-DATABASE (`frorfexbcyfbydkiwxqv`). GeniusPay validation also expects ISO-4217 `currency` on orders.

## Before (SQL)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='orders' AND column_name='currency';
-- → 0 rows
```

Applied migrations included `geniuspay_naming`, `069_commerce_fk_indexes`, etc., but **not** `058_order_currency`.

## Fix

Applied via Supabase MCP `apply_migration` name=`058_order_currency`:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';
-- + CHECK orders_currency_format_check (currency ~ '^[A-Z]{3}$')
NOTIFY pgrst, 'reload schema';
```

App code already inserts `currency: "XOF"` — no GeniusPay/FeexPay contract changes.

## After (SQL)

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='orders' AND column_name='currency';
-- currency | text | NO | 'XOF'::text

SELECT currency, COUNT(*)::int AS n FROM public.orders GROUP BY currency;
-- XOF | 5   (existing rows backfilled by DEFAULT)
```

Migration recorded: version `20261103102411` / name `058_order_currency`.

## Proof

- Unit: `tests/orders-currency-column.test.ts` (migration SQL + insert sites + PO payload XOF)
- Live schema verified via Supabase MCP `execute_sql` (see above)
