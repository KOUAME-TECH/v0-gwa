# État des lieux GWA — 21 juil. 2026 (MAJ soir)

**Branche :** `main`  
**Prod :** https://v0-gwa-mu.vercel.app — healthy  
**Tests :** 88 Vitest OK  

Voir aussi [ops-gaps-closure.md](./ops-gaps-closure.md) pour les actions humaines restantes.

## Sprint code du 21 juil. (fermé dans le code)

| Gap | Statut code |
|-----|-------------|
| Stepper escrow visible | **OK** — panier, confirmation, dashboard commandes |
| Confirm / litige branchés UI | **OK** — APIs + boutons dashboard ; litige via admin client |
| Page `/post/[id]` | **OK** — restaurée avec commentaires vocaux |
| Coach SCG pédagogique | **OK** — 2 actions + TTS |
| Offline utile | **OK** — brouillons IndexedDB publier produit/post |
| Push OneSignal | **OK** — diagnostic + test `GET/POST /api/push/status` |
| Seed 1er admin | **OK** — `POST /api/admin/bootstrap` si zéro admin |
| Admin analytics profondeur | **OK** — escrow held + litiges + labels statut alignés |
| HIBP campagne | **OK** — prolongée au 1 sept. (toggle Dashboard = humain) |
| `CRON_SECRET` / OTP AT live | **Ops humain** — procédure dans ops-gaps-closure.md |

## Bloqueurs encore humains

1. Africa’s Talking SMS live (ou Twilio/Termii)
2. Feexpay merchant checkout URL
3. Poser `CRON_SECRET` sur Vercel
4. Toggle HIBP dans Supabase Dashboard
5. Appeler bootstrap admin une fois si besoin
