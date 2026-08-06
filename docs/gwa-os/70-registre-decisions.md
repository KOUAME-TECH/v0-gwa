# ✅ Registre des décisions GWA

**Règle :** une décision verrouillée ne se rediscute **pas** sans raison nouvelle explicite.  
Le **pourquoi** est obligatoire — c’est lui qui empêche de « corriger » une décision volontaire.

Préfixes : **P-** produit · **T-** tech · **L-** legal · **B-** business

---

## Business

| # | Décidé | Pourquoi |
|---|--------|----------|
| **B-01** | Abonnement = vendeurs (producteurs + coops) ; acheteur retail free forever | Taxer l’acheteur tue le marketplace agri |
| **B-02** | Paliers Free / 7 500 / 18 000 / Enterprise devis ; commissions **8 / 6,5 / 5 %** | FREE = acquisition ; Starter < 10 k ; Pro = volumes sérieux |
| **B-03** | Commission prélevée **vendeur** ; FeexPay = coût tuyau séparé | Évite double prise ; clarté terrain |
| **B-04** | Affacturage = différenciation An.1, pas revenu principal | Focus escrow + abo + GMV d’abord |
| **B-05** | Banques / IMF = partenaires, jamais concurrents | Positionnement infrastructure de confiance |

## Produit

| # | Décidé | Pourquoi |
|---|--------|----------|
| **P-01** | Double identité : post-login → espace métier si `user_type` ; `/admin` via entrée explicite | Un DG producteur ne doit pas « perdre » son espace à chaque login |
| **P-02** | Type de compte verrouillé après onboarding | Évite fraude de rôle / contournement abo |
| **P-03** | Scope bêta = agri (pas formations / learning / artisans génériques) | Focus exécution |
| **P-04** | Soft-launch invite-only tant que FeexPay E2E non vert | Ne pas promettre escrow live sans preuves |

## Tech

| # | Décidé | Pourquoi |
|---|--------|----------|
| **T-01** | FeexPay = provider ; escrow = logique applicative GWA | Pas de promesse séquestre bancaire non tenue |
| **T-02** | PWA d’abord ; **mobile natif après le 1er septembre 2026** | Un seul front critique jusqu’au go-live monétisé |
| **T-03** | Africa’s Talking = SMS OTP ; OneSignal = push | Canaux distincts ; ne pas en supprimer un |
| **T-04** | Colonnes privilégiées profils = `service_role` seul | Empêche auto-élévation dual-identity |
| **T-05** | RBAC admin API = section + action, pas « isAdmin » seul | UI et API doivent dire la même chose |
| **T-06** | Migrations dans `scripts/schema/` ; Deploy GitHub Supabase OFF par défaut | Évite double application / drift |

## Legal

| # | Décidé | Pourquoi |
|---|--------|----------|
| **L-01** | Contenu investisseurs hors OS, racine teamspace | Fil d’Ariane Notion ne doit pas exposer l’OS interne |
| **L-02** | N’écrire aux investisseurs que ce qui reste vrai si le plan change | Crédibilité ; éviter docs périmées partagées |

---

## Comment ajouter une décision

1. Choisir le préfixe + numéro suivant.
2. Une phrase **décidé** + une phrase **pourquoi**.
3. Lister dans Dashboard → Décisions récentes.
4. Ne pas rouvrir sans noter la **raison nouvelle** ici.
