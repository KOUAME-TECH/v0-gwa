# État des lieux GWA — 21 juil. 2026 (MAJ liens + secrets)

**Prod :** https://v0-gwa-mu.vercel.app — healthy  
**Branche fix :** `cursor/fix-broken-links-f056`

## Vérifs runtime (MCP)

| Check | Résultat |
|-------|----------|
| Health | OK, DB connected |
| `OTP_PEPPER` | **OK** — send-otp 200 (hash OK ; plus d’erreur pepper) |
| SMS OTP | **OK** — Path A Supabase Phone OK ; `hasSmsProvider` passe (AT/Twilio/Termii) |
| `CRON_SECRET` | Posé (401 sans/faux Bearer ; attendu) |
| OneSignal MCP | App `GWA` présente |
| HIBP Supabase | OFF (souvent Pro) — reporté |

Après deploy, `/api/health` expose `secrets.{OTP_PEPPER,CRON_SECRET,SMS_AT,SMS_TWILIO,SMS_TERMII}` en booléens.

## Bugs corrigés (ce tour)

1. Signup : `/legal/terms` + `/legal/privacy` 404 → `/conditions` + `/confidentialite` (+ redirects)
2. `/feed` 404 → redirect `/`
3. `/cooperatives` requête `member_count`/`cooperative_type` inexistants (400) → schéma réel
4. Fiche `/cooperatives/[id]` manquante → page détail
5. Create coop : `slug` NOT NULL manquant → slug auto
6. Lien rejoindre `?id=` vs `?coop=` → `?coop=`
7. Rate-limit : pages GET hors compteur (plus de 429 navigation/RSC)

## Reste humain / partenaire

- Confirmer cron avec vrai Bearer `CRON_SECRET`
- Feexpay merchant checkout live
- HIBP si upgrade Supabase Pro
- Tester SMS reçu sur téléphone (probes OTP déjà envoyés)
