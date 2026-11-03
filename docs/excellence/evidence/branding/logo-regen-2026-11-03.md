# Issue 2 — Logo PNG regeneration (best quality)

## Source of truth

- Vector: `public/icon.svg` — white geometric **G** + ochre leaf (`#C27D10`) on green `#1F5C2E` (Harmattan)
- SVG refined so the leaf has a clear midrib (aligned with prior high-res PNG brand look)
- Raster export: Playwright Chromium screenshot of the SVG at exact pixel sizes, then sharp PNG re-encode (lossless palette=false, compressionLevel 9)

## Regenerated paths

| Path | Size |
|------|------|
| `public/icon-32.png` | 32×32 |
| `public/apple-icon.png` | 180×180 |
| `public/icon-192.png` | 192×192 |
| `public/icon-512.png` | 512×512 |
| `public/icon-master.png` | 1024×1024 |
| `docs/excellence/evidence/branding/marketplace-logo-header-320.png` | 320×320 |
| `docs/excellence/evidence/branding/marketplace-logo-header-1024.png` | 1024×1024 |
| `docs/excellence/evidence/branding/mcp-marketplace-logo-320.png` | 320×320 |
| `docs/excellence/evidence/branding/mcp-marketplace-logo-1024.png` | 1024×1024 |
| `docs/excellence/evidence/branding/po-watermark.png` | 512×512 soft mark |

## Wiring (unchanged, verified correct)

- `app/layout.tsx` metadata icons → `/icon.svg`, `/icon-32.png`, `/icon-192.png`, `/icon-512.png`, `/apple-icon.png`
- `public/manifest.json` PWA icons → same PNGs + SVG
- `components/brand/gwa-mark.tsx` → `/icon.svg`
- `lib/chat/purchase-order.ts` print HTML mark → inline SVG matching `icon.svg`
