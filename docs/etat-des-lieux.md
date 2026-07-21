# État des lieux GWA — 21 juil. 2026 (05h UTC)

**Prod :** https://v0-gwa-mu.vercel.app — **healthy** (DB connected)  
**Commit prod :** `8e02f14` (merge PR #8)  
**Dernier deploy :** `dpl_EKjvezEMaCCnY6xBqmnhvTdMfc9Y` — **READY** (redeploy)  
**Cible bêta :** 1er sept. 2026 · scope F1–F6  

---

## Verdict

| Zone | Statut |
|------|--------|
| Plateforme / build / health | **GO** |
| Produit code (escrow, litige, post, coach, offline, push UI, admin) | **GO** |
| Ops secrets + SMS + paiement live | **NO-GO partiel** (humain / hors Pro) |

---

## Infra & données (live MCP)

| Indicateur | Valeur |
|------------|--------|
| Utilisateurs (`profiles`) | 11 |
| Admins actifs | 3 |
| Produits actifs | 3 |
| Commandes | 2 |
| Litiges | 0 |
| Supabase HIBP (leaked passwords) | **OFF** (nécessite souvent plan Pro Supabase) |
| Cron sans Bearer | 401 « Non autorisé » (comportement attendu) |

---

## Produit — ce qui est OK en code + prod

| Domaine | Statut | Notes |
|---------|--------|-------|
| Feed / marketplace / audio Harmattan | **OK** | Digest, onde, écoute, rituels, contraste |
| Commentaires texte + voix | **OK** | Migration 039 |
| `/post/[id]` | **OK** | FormData aligné feed |
| Escrow stepper | **OK** | Panier, confirmation, dashboard, admin |
| Confirm réception / litige | **OK** | Gate `held` ; dialog ; admin release/refund |
| Coach SCG | **OK** | 3 actions ; `/scg` + dashboard farmer |
| Offline | **OK** | Brouillons IndexedDB + hint reconnect ; SW v12 |
| OneSignal UI | **OK** | Activer / Tester sur `/notifications` |
| Admin orders / disputes / analytics | **OK** | Escrow + période |
| Seed admin | **OK** | 3 admins déjà en base — bootstrap inutile |
| PWA | **OK** | Icons Harmattan, install |
| Inventaire routes | ~74 complete / 9 partial / 1 missing / 16 redirect | |

---

## Bloqueurs / actions humaines

### P0 — à faire (Hobby Vercel OK, pas de Pro)

1. **`CRON_SECRET`** + **`OTP_PEPPER`** dans Vercel → Env Vars → Redeploy  
   - Génération PowerShell (sans openssl) :
     ```powershell
     $bytes = New-Object byte[] 32
     [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
     ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
     ```
   - Ou https://generate-secret.vercel.app/32  
   - Test cron : `curl.exe -H "Authorization: Bearer SECRET" https://v0-gwa-mu.vercel.app/api/cron/harmattan-digest`

2. **OTP SMS live** — clés Africa’s Talking (ou Twilio / Termii) sur Vercel  
   - Sans ça : login téléphone ne délivre pas de vrai SMS

### P1 — hors plan gratuit / partenaire

3. **HIBP (leaked passwords)** — advisor Supabase encore OFF ; souvent **plan Pro Supabase** requis → **reporter post-bêta** ; bannière GWA jusqu’au 1 sept. suffit pour l’instant  
4. **Feexpay live** — compte marchand + `payment_url` (checkout réel bloqué)  
5. **OneSignal** — vérifier `NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` + test HTTPS sur `/notifications`

### Non bloquant

- Cron Vercel 1×/jour (`0 6 * * *`) = compatible Hobby  
- Si cron Vercel capricieux → cron-job.org gratuit + header Bearer  
- PR draft #6 / #7 / #2 ouvertes — hors chemin critique

---

## Erreurs runtime récentes (MCP Vercel)

| Erreur | Statut |
|--------|--------|
| `OTP_PEPPER manquant` (20 juil.) | À confirmer après pose env + redeploy |
| SSL migration 039 | Ancien ; migrations 039/040 déjà appliquées |

---

## Priorité concrète pour toi (ordre)

1. Coller `CRON_SECRET` + `OTP_PEPPER` sur Vercel → Redeploy  
2. Configurer SMS OTP (AT / Twilio / Termii)  
3. Tester login téléphone + push `/notifications`  
4. Feexpay quand le compte marchand est prêt  
5. HIBP : ignorer jusqu’à upgrade Supabase Pro  

Quand 1–2 sont faits, dis-le — re-vérif MCP.
