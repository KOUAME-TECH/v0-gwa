# Fermeture des gaps ops — 21 juil. 2026

Actions **humaines** restantes après le sprint code escrow / coach / offline / push.

## 1. `CRON_SECRET` (Harmattan Digest)

1. Génère un secret : `openssl rand -hex 32`
2. Vercel → Project → Settings → Environment Variables → `CRON_SECRET` (Production + Preview)
3. Redeploy
4. Test manuel :
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://v0-gwa-mu.vercel.app/api/cron/harmattan-digest
   ```
5. Le cron `0 6 * * *` dans `vercel.json` enverra automatiquement le header.

## 2. Seed 1er admin

**Option A — API (recommandée si aucun admin) :**
1. Connecte-toi sur la prod avec ton compte
2. `POST /api/admin/bootstrap` (cookie session)
3. Va sur `/admin`

**Option B — SQL Supabase :**
```sql
-- scripts/ops/005_create_first_admin.sql
SELECT promote_to_admin('ton@email.com', 'super_admin');
```

## 3. HIBP (Have I Been Pwned)

1. Supabase Dashboard → Authentication → Providers / Password security
2. Activer **Leaked password protection**
3. Bannière GWA prolongée jusqu’au **1er sept. 2026** (`lib/auth/hibp-banner.ts`)

## 4. OTP SMS live (Africa’s Talking)

Si AT renvoie 401 :
1. Vérifier `AT_USERNAME` = nom d’app **live** (pas sandbox) sauf si `AT_SANDBOX=true`
2. Régénérer `AT_API_KEY` dans le dashboard AT
3. `AT_SENDER_ID` approuvé pour CI
4. Fallbacks déjà câblés : Twilio (`TWILIO_*`) puis Termii (`TERMII_API_KEY`)

Test : `POST /api/auth/send-otp` avec un numéro E.164.

## 5. OneSignal push

1. Vérifier `NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` sur Vercel
2. Ouvrir l’app en HTTPS, accepter les notifs
3. Diagnostic : `GET /api/push/status` (auth)
4. Test : `POST /api/push/status` → notif « Test GWA Push »

## 6. Feexpay live (toujours bloquant checkout réel)

Compte marchand + wiring `payment_url` — hors de ce sprint code.
