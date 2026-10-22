-- 058 — Explicit ISO 4217 currency for orders; existing beta orders default to XOF.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_currency_format_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_currency_format_check
      CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
END;
$$;
