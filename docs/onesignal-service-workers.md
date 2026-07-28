# OneSignal Web Push — config dashboard GWA

Les fichiers dans `public/` (racine Vercel) :

| Champ dashboard (**Advanced Push Settings**) | Valeur |
|----------------------------------------------|--------|
| **Main Filename** | `OneSignalSDKWorker.js` |
| **Updater Filename** | `OneSignalSDKUpdaterWorker.js` |
| **Path / Registration Scope** | `/` |

Sans **Path = `/`**, OneSignal affiche l’erreur **“Path is required”**.

URL de contrôle :
- `https://<ton-domaine>/OneSignalSDKWorker.js`
- `https://<ton-domaine>/OneSignalSDKUpdaterWorker.js`

Contenu des workers (v21) : `importScripts` OneSignal **puis** cache offline GWA (`gwa-v21-offline`) — shell (`/`, `/marketplace`, `/publier`), navigations network-first, fallback `/offline.html`.

Le SDK client (`components/pwa/onesignal-provider.tsx`) utilise :

- `appId`: `5f01e343-a7a2-4ae8-8baa-655388e239bc` (ou `NEXT_PUBLIC_ONESIGNAL_APP_ID`)
- `serviceWorkerPath`: `OneSignalSDKWorker.js`
- `serviceWorkerUpdaterPath`: `OneSignalSDKUpdaterWorker.js`
- `serviceWorkerParam.scope`: `/`

**À faire dans OneSignal → Settings → Platforms → Web** :
1. Remplir Main / Updater / **Path = `/`**
2. Ajouter les origines (prod + preview Vercel)
3. Sauvegarder, recharger le site, accepter les notifs

`/sw.js` reste un miroir du même worker (installations PWA anciennes).
