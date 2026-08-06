# 🌾 Producteurs & Coops

**Domaine stable** — cycle de vie de l’offre, validation, abonnements vendeur.

---

## État actuel

- Rôles DB : `producteur` | `acheteur` | `cooperative` (+ libellés hérités mappés).
- **Abo vendeur** : Free / Starter 7 500 / Pro 18 000 / Enterprise devis.
- Commissions GWA : **8 % / 6,5 % / 5 %** (prélevées vendeur).
- Activation abo : demande in-app → preuve WhatsApp → **admin active** (ou téléphone).
- Coops : validation progressive + multi-gestionnaires (code) ; **0 coop** en snapshot prod récent.
- Quotas Yelly liés au palier vendeur (et séparés admin Yelly Ops).

## Règles établies

1. Abo = **côté offre** uniquement (B-01).
2. FREE : max **5** annonces actives ; porte d’entrée 1ʳᵉ vente.
3. Gros individuels → PRO ; coops structurées → ENTERPRISE (B-02 / pricing DG).
4. Type de compte non modifiable self-service.
5. Affacturage = rétention / différenciation, **pas** revenu An.1 principal.
6. Banques / IMF = **partenaires**, jamais concurrents (positionnement).

## Cycle de vie offre (simplifié)

```
Inscription OTP → onboarding type → publier → vente(s)
     → option demande abo → admin active → entitlements
```

## Questions ouvertes

- Date cible pour abo payé FeexPay (fin WhatsApp-only) ?
- Critères concrets « coop validée » affichés UI (checklist) ?
- Expiry mensuelle automatique Free (P1-C) — OK produit ?

## Liens repo

- `docs/decision-strategique-pricing-gwa-2026-07-28.md`
- `docs/abonnements-services-alignes-2026-07-28.md`
- `docs/politique-cooperatives-types-compte.md`
- `app/abonnement/page.tsx` · `app/admin/subscriptions/`
