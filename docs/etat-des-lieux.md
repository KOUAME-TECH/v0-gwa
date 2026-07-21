# État des lieux GWA — 21 juil. 2026 (MAJ debug)

**Prod :** https://v0-gwa-mu.vercel.app — healthy  
**Commit cible :** fixes PDP / agriculture / auth alias (ce sprint)

## Vérifs runtime (MCP)

| Check | Résultat |
|-------|----------|
| Health | OK, DB connected |
| `OTP_PEPPER` | **OK** — send-otp 200 (hash OK) |
| SMS OTP | **OK** — provider `africastalking` live |
| `CRON_SECRET` | Posé (401 sans/faux Bearer ; attendu) |
| HIBP Supabase | OFF (souvent Pro) — reporté |

## Bugs corrigés (ce tour)

1. `/produit/[id]` crash `shouldShowVerifiedBadge` non importé  
2. `/agriculture` select `products.is_verified` (400) → profiles  
3. `/auth/sign-up` 404 → redirect `/auth/signup`  
4. Nav « Explorer » forçait login invité → `/recherche` ouvert  
5. CSP OneSignal `api.onesignal.com`  
6. Rate-limit middleware trop bas (auth 10→30, default 120→240)

## Reste humain / partenaire

- Feexpay merchant checkout live  
- HIBP si upgrade Supabase Pro  
- Tester réception réelle SMS sur ton téléphone (code déjà envoyé en probe)
