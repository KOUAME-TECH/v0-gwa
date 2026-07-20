# Contrat API — SCG v2 (FastAPI) — post-bêta Q4 2026+

> Bêta sept. 2026 : moteur **v1 TypeScript** (`lib/scg/engine.ts`) + snapshots `scg_scores`.
> Ce document fige le contrat pour le service FastAPI 5C sans bloquer le GO.

## Objectif

Exposer un scoring conforme aux **5 C du crédit** pour partenaires bancaires :

| C | Contenu | Poids couche |
|---|---------|--------------|
| Character | Moralité / comportement transactionnel | inclus dans 50% transactionnel |
| Capacity | Capacité de remboursement | 50% transactionnel |
| Capital | Fonds propres / actifs | 20% institutionnel |
| Collateral | Garanties | 20% institutionnel |
| Conditions | Contexte marché | 30% engagement |

**Couches agrégées** : transactionnel 50% · engagement 30% · institutionnel 20%.

**Seuils** : 500 bancable · 600 éligibilité crédit · 800 élite.

## Endpoint cible

`POST /scg/v2/calculate`

### Request

```json
{
  "user_id": "uuid",
  "as_of": "2026-09-01T00:00:00Z",
  "inputs": {
    "orders_honored_rate": 0.92,
    "gmv_fcfa": 1500000,
    "dispute_rate": 0.02,
    "active_months": 6,
    "kyc_level": "basic",
    "cooperative_id": null
  }
}
```

### Response

```json
{
  "user_id": "uuid",
  "score_total": 620,
  "badge": "confirme",
  "bancable": true,
  "credit_eligible": true,
  "elite": false,
  "layers": {
    "transactionnel": 58,
    "engagement": 42,
    "institutionnel": 35
  },
  "five_c": {
    "character": 70,
    "capacity": 55,
    "capital": 30,
    "collateral": 20,
    "conditions": 40
  },
  "explainability": [
    "Taux d'honoration commandes élevé",
    "Capital documenté insuffisant pour élite"
  ],
  "calculated_at": "2026-09-01T12:00:00Z",
  "model_version": "scg-v2.0.0"
}
```

## Intégration GWA (Next.js)

1. Service FastAPI hébergé séparément (auth mTLS ou clé `SCG_API_KEY`).
2. Next route `POST /api/scg/calculate` appelle FastAPI si `SCG_V2_URL` défini, sinon fallback v1.
3. Persister snapshot dans `scg_scores` (+ colonnes `five_c` JSON post-migration).
4. Afficher dimensions 5C dans `/admin/scg` et export partenaire.

## Hors scope bêta

- Ne pas bloquer le GO sur ce service.
- Ne pas exposer FastAPI à `anon`.
- Affacturage continue d’utiliser `scg_bancable` / score ≥ 500 (v1).
