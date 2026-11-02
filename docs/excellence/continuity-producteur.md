# Continuité — Parcours Producteur (ISO 22301)

| Actif | RTO / RPO | Preuve |
| --- | --- | --- |
| Annonces `products` | RPO ≤ 24 h (backup Supabase) | PITR [ACTION HUMAINE] |
| Media Storage `products` | Objects publics catalogue | bucket public=true (marché) |
| KYC `kyc-documents` | Privé | public=false |
| File offline publish | Local IndexedDB | `lib/offline/publish-queue` + tests |
| Retraits `withdrawal_requests` | Ops manuel | API withdraw sans GeniusPay mutation |

## Reprise producteur

1. Auth login → `/dashboard/farmer`
2. Flush file publish si `online`
3. Vérifier ventes `/dashboard/commandes?` onglet ventes
4. Wallet solde = livré − retraits

[FAIT VÉRIFIÉ] Queue offline unit-tested.  
[ACTION HUMAINE REQUISE] Exercice restore backup staging.
