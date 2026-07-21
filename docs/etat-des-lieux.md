# État des lieux GWA — 21 juil. 2026 (fermeture PARTIEL)

**Branche travail :** `cursor/cloud-agent-1784519810125-lmf8f`  
**Prod :** https://v0-gwa-mu.vercel.app  
Voir [ops-gaps-closure.md](./ops-gaps-closure.md) pour les actions humaines.

## Gaps fermés dans le code (PARTIEL → OK)

| Gap | Statut |
|-----|--------|
| Stepper escrow visible | **OK** — panier, confirmation, dashboard + **admin orders** ; étape Confirmé (3) corrigée |
| Confirm / litige UI | **OK** — gate `held` ; dialog motif+preuve ; reasons CHECK DB ; admin resolve → escrow |
| Page `/post/[id]` | **OK** — FormData aligné feed (`type`/`id`/`text`) |
| Coach SCG | **OK** — 3 actions + bandes score ; `/scg` + **dashboard farmer** |
| Offline utile | **OK** — IndexedDB + hint reconnect si brouillon |
| Push OneSignal | **OK** — `/notifications` Activer/Tester + `/api/push/status` |
| Seed 1er admin | **OK** — bootstrap ; GET auth-gate |
| Orders / disputes / analytics | **OK** — profondeur escrow + période analytics |
| HIBP campagne | **OK** code — toggle Dashboard = humain |
| `CRON_SECRET` / OTP AT | **Ops humain** |

## Bloqueurs encore humains

1. Africa’s Talking / Twilio / Termii live
2. Feexpay merchant checkout
3. Poser `CRON_SECRET` sur Vercel
4. Toggle HIBP Supabase
5. `POST /api/admin/bootstrap` une fois si besoin
6. Clés OneSignal + test navigateur HTTPS
