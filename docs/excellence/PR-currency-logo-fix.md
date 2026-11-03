# PR body — Fix orders.currency + logo PNG quality

## Summary

1. **CRITICAL:** Production offer validation failed with PostgREST `Could not find the 'currency' column of 'orders' in the schema cache`. Root cause: `orders.currency` missing on live GWA-DATABASE; migration `058_order_currency` was in-repo but never applied. Applied on prod DB + documented before/after SQL. App already inserts `currency: "XOF"` (GeniusPay contracts untouched).
2. **Brand:** Regenerated Harmattan logo PNGs (32 / 180 / 192 / 512 / 1024) from authoritative SVG via Chromium export; refreshed PO watermark + evidence assets; PO print mark aligned with SVG.

## Test plan

- [x] `pnpm test -- tests/orders-currency-column.test.ts`
- [x] Live SQL: `orders.currency` exists, default `XOF`, 5 rows backfilled
- [x] Visual Read on `public/icon-512.png`, `icon-master.png`, `apple-icon.png`
- [ ] Manual: accept chat offer → order creates without schema-cache error
- [ ] Manual: favicon / PWA icon / header mark look crisp

## Evidence

- `docs/excellence/evidence/orders-currency-058.md`
- `docs/excellence/evidence/branding/logo-regen-2026-11-03.md`
