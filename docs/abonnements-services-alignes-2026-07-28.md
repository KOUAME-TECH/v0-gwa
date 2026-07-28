# Alignement abonnements ↔ services — 28/07/2026

**Règle :** tout bénéfice listé sur `/abonnement` est délivré par `lib/pricing/entitlements.ts`.

| Palier | Prix | Commission | Services code |
|--------|------|------------|---------------|
| Free | 0 | 8 % | Max 5 annonces, digest, SCG base |
| Starter | 7 500 | 6,5 % | Illimité, boost catalogue, stats `/api/seller/stats` |
| Pro | 18 000 | 5 % | Priorité feed/boutique, badge Pro, SCG avancé, priorité affacturage, reporting |
| Enterprise | devis | ≤ 5 % | + multi-gestionnaires, account manager ops |

## Paiement / escrow (promesse BP)

- Pay-in : `POST /api/orders/[id]/pay` → FeexPay `requesttopay/{network}` + `payment_url`
- Hold : statut applicatif `escrow_status=held` (fonds compte marchand)
- Release : `POST /api/orders/[id]/confirm` → FeexPay `payouts/public/{network}` du net vendeur
- Retrait wallet : `POST /api/wallet/withdraw` (plus de simulation UX)

Migration : `scripts/schema/053_payout_withdrawals_entitlements.sql` (appliquée).
