# OneSignal Web Push — config dashboard GWA

Les fichiers sont déjà dans `public/` (servis à la racine Vercel) :

| Champ dashboard | Valeur |
|-----------------|--------|
| **Main Filename** | `OneSignalSDKWorker.js` |
| **Updater Filename** | `OneSignalSDKUpdaterWorker.js` |
| **Registration Scope** | `/` |

URL de contrôle :
- `https://<ton-domaine>/OneSignalSDKWorker.js`
- `https://<ton-domaine>/OneSignalSDKUpdaterWorker.js`

Le SDK (`components/pwa/onesignal-provider.tsx`) pointe sur ces mêmes chemins.

**À faire dans OneSignal → Settings → Platforms → Web** :
1. Remplir les 3 champs ci-dessus
2. Ajouter les origines (prod + preview Vercel)
3. Sauvegarder, puis recharger le site et accepter les notifs

`/sw.js` reste disponible (même logique offline) pour les anciennes installations.
