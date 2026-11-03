# AUDIT MASTER + AUDIO — Mission 1

**Date** : 2026-11-03  
**Branche** : `gwa/excellence-parcours-1e99` @ `dc4c9d5`  
**Prod** : https://mygwa.org · SHA live `2f9d54b` (stale vs tip)  
**Contraintes** : PR #27 **non mergée** · GeniusPay/FeexPay **FROZEN** · secrets jamais imprimés

## Sondes live

| Check | Résultat |
| --- | --- |
| `curl -I https://mygwa.org/robots.txt` | **404** (shell HTML Vercel) |
| `curl -I https://mygwa.org/sitemap.xml` | **404** |
| `GET /api/health` | **200** · `db=connected` · `rate_limit_redis=true` · GeniusPay `configured=false` |
| Supabase junk profiles / products / posts public junk | **0 / 0 / 0** · products_active=3 · posts_public=1 · private=4 |
| Security advisor | WARN seul = HIBP leaked-password **OFF** (humain) |
| Upstash `gwa-prod` | active · free · eu-west-1 |
| Vercel deploy token (`VERCEL_TOKEN` / `Cursor_Agent`) | **MISSING** dans le runtime agent (`CURSOR_AGENT` = flag `1`) |
| Vercel MCP deploy | **403** (historique) |

## Asset logo

| Fichier | Statut |
| --- | --- |
| `public/icon-master.png` | **SOURCE** 1024×1024 RGBA (présent) |
| `public/master.png` | alias bytes-identiques (ajouté Mission 2) |
| `public/icon.svg` / `icon-32/192/512` / `apple-icon.png` | dérivés Harmattan |
| `docs/excellence/evidence/branding/po-watermark.png` | watermark soft 512 |

## Table Problem \| Severity \| File \| Fix

| Problem | Severity | File | Fix |
| --- | --- | --- | --- |
| robots.txt / sitemap.xml 404 en prod (code présent `app/robots.ts` + `sitemap.ts` non déployé) | **P0 SEO** | tip non déployé | Deploy tip → Production (Dashboard / `VERCEL_TOKEN`) |
| Header/Navbar `GwaMark` pointe `/icon.svg` au lieu de `icon-master.png` | **P1 Brand** | `components/brand/gwa-mark.tsx` | `src="/icon-master.png"` (+ alias `/master.png`) |
| Metadata icons sans référence master / OG pas master | **P2 Brand** | `app/layout.tsx` | Ajouter `/icon-master.png` + `/master.png` dans icons |
| PO print watermark = SVG inline, pas l’asset master PNG | **P2 Brand** | `lib/chat/purchase-order.ts` | Watermark `https://mygwa.org/icon-master.png` (fallback SVG) |
| Playback vocal = `new Audio().play()` sans pause/seek/vitesse/progress | **P0 Audio** | `components/chat/chat-conversation.tsx` `playVoiceMsg` | Player WhatsApp : play/pause, waveform progress, 0.5/1/1.5/2×, seek |
| Preview play bouton `w-8 h-8` (<44px) | **P2 A11y** | `chat-conversation.tsx` preview bar | Contrôles ≥44px |
| Preview sans « re-enregistrer » (delete seulement) | **P1 UX** | preview bar | Bouton re-record → relance `toggleVoice` |
| Annulation swipe absente (X/trash seulement) | **P2 UX** | recording bar | Gesture swipe-left ou X pour cancel |
| STT sous bulle OK ; pas de progress waveform pendant lecture | **P1 Audio** | voice bubble | Waveform progress liée à `currentTime/duration` |
| Autoplay absent (OK) | — | — | Conserver no-autoplay |
| MIME/size + signed URL + bucket private | OK | `lib/chat/upload.ts` · migrations 066/068 | Étendre tests ; pas de régression GeniusPay |
| Prod SHA stale `2f9d54b` vs tip | **P0 Deploy** | Vercel Hobby / SSO | UNIQUE NEXT = Dashboard Redeploy tip |
| HIBP password protection OFF | **P2 Sec** | Supabase Auth | ACTION HUMAINE Dashboard Auth |
| Redis free plan · backups vides | **P3 Continuité** | Upstash | ACTION HUMAINE backups / upgrade |

## Module audio — état actuel vs cible WhatsApp

| Capacité | Avant audit | Cible |
| --- | --- | --- |
| Record mic + bar + timer + waveform live DSP | ✅ | ✅ |
| Preview play/delete avant envoi | ⚠️ play <44px · pas re-record | ✅ + re-record |
| Cancel X | ✅ | ✅ + swipe |
| STT sous preview + bulle | ✅ Web Speech | ✅ |
| Playback play/pause + progress waveform | ❌ | ✅ |
| Speed 0.5/1/1.5/2× | ❌ | ✅ |
| Seekable | ❌ | ✅ |
| A11y ≥44px / ARIA / no autoplay | partiel | ✅ |
| Security MIME/size/signed/RLS | ✅ | ✅ |

## Preuves audit

- `evidence/master-audio/audit-home-logo-320.png`
- Health JSON live (redis true, GeniusPay false)
- SQL junk counts (ci-dessus)

## Décision

Passer **Mission 2 (logo master)** puis **Mission 3 (player audio WhatsApp)** puis excellence loop + tentative deploy.
