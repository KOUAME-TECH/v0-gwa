# Harmattan Digest — scheduling

## Source de vérité : Supabase pg_cron

| Élément | Valeur |
|--------|--------|
| Extension | `pg_cron` |
| Fonction | `public.run_harmattan_digest()` |
| Job | `gwa-harmattan-digest-daily` |
| Schedule | `0 6 * * *` (06:00 UTC) |
| Journal | table `digest_runs` |
| Migration | `scripts/schema/041_harmattan_digest_pg_cron.sql` |

La fonction crée des **notifications in-app** (type `digest`, deep-link `/marketplace?digest=1`).
Elle ne dépend **pas** de `CRON_SECRET` Vercel.

Smoke test :

```sql
SELECT public.run_harmattan_digest();
SELECT * FROM digest_runs ORDER BY id DESC LIMIT 5;
SELECT * FROM cron.job WHERE jobname = 'gwa-harmattan-digest-daily';
```

## Secours push OneSignal (optionnel)

Route Next.js `POST/GET /api/cron/harmattan-digest` envoie aussi les push OneSignal.
Auth : `Authorization: Bearer $CRON_SECRET` **ou** header `x-gwa-digest-key: $DIGEST_INTERNAL_KEY`.

Le cron Vercel a été retiré de `vercel.json` — le planning principal est Supabase.
