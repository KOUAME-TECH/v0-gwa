# PR note — SW / CSP / OneSignal (console & runtime)

**Branche** : `gwa/excellence-parcours-1e99`  
**Ne pas merger** · GeniusPay **FROZEN**  
**Cibles** : preview `https://v0-gwa-gwa.vercel.app` · prod `https://mygwa.org`

## Root causes

1. **`message` listener trop tard (sw.ts / OneSignal SDK)**  
   `OneSignalSDK.sw.js` enregistre un 2ᵉ handler `message` dans `setTimeout(fn, 0)` (`WorkerMessenger.F` / `_listen`). Chrome exige ces listeners à l’évaluation synchrone initiale du worker → warning console.

2. **OneSignal SW × Supabase auth**  
   Notre `fetch` handler (network-first sur tout GET non-API) interceptait les requêtes cross-origin (`*.supabase.co/auth/v1/user`). Avec `clients.claim()` + SW contrôlant la page → `FetchEvent` / `Failed to fetch`.

3. **Origine absente du dashboard OneSignal**  
   `https://v0-gwa-gwa.vercel.app` (et parfois `mygwa.org`) non listés dans Settings → Platforms → Web → erreur / warn non soft-failée proprement.

4. **CSP `connect-src`**  
   Aperçu carte `https://staticmap.openstreetmap.de/...` bloqué quand le fetch passe par le SW / connect-src (img-src `https:` seul ne suffit pas pour le chemin SW).

## Fixes (code)

| Fichier | Changement |
| --- | --- |
| `public/OneSignalSDKWorker.js` (+ Updater + `sw.js`) | v22 : `setTimeout(0)` forcé sync pendant `importScripts` ; listener `message` top-level ; **pass-through** cross-origin / `*.supabase.co` / staticmap / `/api` |
| `components/pwa/onesignal-provider.tsx` | allowlist origines ; warn **once** ; skip init hors allowlist ; soft-recover `/sw.js` si dashboard refuse le domaine |
| `components/pwa/service-worker-register.tsx` | pas de double register si origine OS allowlistée ; sinon `/sw.js` offline |
| `lib/notifications/onesignal-config.ts` | `GWA_ONESIGNAL_ALLOWED_ORIGINS` + `isOneSignalOriginAllowed` |
| `next.config.mjs` | `staticmap.openstreetmap.de` dans **img-src** et **connect-src** |

## Étape humaine OneSignal (obligatoire)

Dashboard OneSignal → app **GWA** (`5f01e343-a7a2-4ae8-8baa-655388e239bc`) → **Settings → Platforms → Web (Typical Site)** → Site URL / allowed origins :

- `https://mygwa.org`
- `https://www.mygwa.org` (si utilisé)
- `https://v0-gwa-gwa.vercel.app`
- `https://v0-gwa-mu.vercel.app` (alias historique)

Workers dashboard : Main `OneSignalSDKWorker.js` · Updater `OneSignalSDKUpdaterWorker.js` · scope `/`.

MCP OneSignal : app listée OK ; `get_app_push_platforms` → **401** (REST key MCP) — pas de mutation / pas d’envoi de messages.

## Vérif

- `npx vitest run tests/sw-csp-onesignal.test.ts tests/shell-cron-onesignal.test.ts`
- Grep : `shouldPassThrough`, `staticmap.openstreetmap.de`, `isOneSignalOriginAllowed`, `gwa-v22-offline`
