# Ops — Notifications (OneSignal + Digest)

## OneSignal Web Push

Fichiers `public/` :

| Champ dashboard | Valeur |
|-----------------|--------|
| Main Filename | `OneSignalSDKWorker.js` |
| Updater Filename | `OneSignalSDKUpdaterWorker.js` |
| Path / Scope | `/` |

Sans **Path = `/`**, OneSignal exige le path.  
Workers v21 : OneSignal + cache offline `gwa-v21-offline`.  
`/sw.js` = miroir (anciennes installs PWA).

## Harmattan Digest (cron)

| Élément | Valeur |
|--------|--------|
| Extension | `pg_cron` |
| Fonction | `public.run_harmattan_digest()` |
| Job | `gwa-harmattan-digest-daily` |
| Schedule | `0 6 * * *` (06:00 UTC) |
| Migration | `scripts/schema/041_harmattan_digest_pg_cron.sql` |

Secours push : `POST/GET /api/cron/harmattan-digest` (`CRON_SECRET` ou `DIGEST_INTERNAL_KEY`).
