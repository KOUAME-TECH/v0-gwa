# Fermeture des gaps ops — 21 juil. 2026 (MAJ profondeur code)

Sprint code (branche `cursor/cloud-agent-1784519810125-lmf8f` → merge `main`) :
escrow stepper admin + step Confirmé, confirm gated `held`, litige dialog + reasons CHECK,
admin dispute → escrow release/refund, `/post/[id]` FormData fix, coach 3 actions + farmer,
offline reconnect hint, OneSignal Activer/Tester, bootstrap GET auth-gate.

## Actions **humaines** restantes

### 1. `CRON_SECRET` (Harmattan Digest)

1. Génère : `openssl rand -hex 32`
2. Vercel → Settings → Environment Variables → `CRON_SECRET` (Production + Preview)
3. Redeploy
4. Test :
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://v0-gwa-mu.vercel.app/api/cron/harmattan-digest
   ```

### 2. Seed 1er admin

Connecté en prod → `POST /api/admin/bootstrap` (si zéro admin).  
Ou SQL : `scripts/ops/005_create_first_admin.sql`

### 3. HIBP (Have I Been Pwned)

Supabase Dashboard → Authentication → Password security → **Leaked password protection** ON.  
Bannière GWA jusqu’au **1er sept. 2026**.

### 4. OTP SMS live

Africa’s Talking live (`AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`)  
ou Twilio / Termii (fallbacks déjà câblés).

### 5. OneSignal

`NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` sur Vercel.  
UI : `/notifications` → **Activer** / **Tester**.

### 6. Feexpay live (checkout réel)

Compte marchand + `payment_url` — hors sprint UI.
