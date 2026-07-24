# OneSignal Web Push — config dashboard GWA

Les fichiers officiels sont dans `public/` (racine Vercel) :

| Champ dashboard (**Advanced Push Settings**) | Valeur |
|----------------------------------------------|--------|
| **Main Filename** | `OneSignalSDKWorker.js` |
| **Updater Filename** | `OneSignalSDKUpdaterWorker.js` |
| **Path / Registration Scope** | `/` |

Sans **Path = `/`**, OneSignal affiche l’erreur **“Path is required”**.

URL de contrôle :
- `https://<ton-domaine>/OneSignalSDKWorker.js`
- `https://<ton-domaine>/OneSignalSDKUpdaterWorker.js`

Contenu attendu des workers (fichier officiel v16) :

```js
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

Le SDK client (`components/pwa/onesignal-provider.tsx`) utilise :

- `appId`: `5f01e343-a7a2-4ae8-8baa-655388e239bc` (ou `NEXT_PUBLIC_ONESIGNAL_APP_ID`)
- `serviceWorkerPath`: `OneSignalSDKWorker.js`
- `serviceWorkerUpdaterPath`: `OneSignalSDKUpdaterWorker.js`
- `serviceWorkerParam.scope`: `/`

**À faire dans OneSignal → Settings → Platforms → Web** :
1. Remplir Main / Updater / **Path = `/`**
2. Ajouter les origines (prod + preview Vercel)
3. Sauvegarder, recharger le site, accepter les notifs

`/sw.js` reste disponible (OneSignal + cache offline GWA) pour les anciennes installations PWA.
