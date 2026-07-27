# Analyse — Business Plan détaillé GWA

**Source :** `GWA_Business_Plan_Detaille.docx` (v. 23 juil. 2026)  
**Croisement :** prod https://v0-gwa-mu.vercel.app + repo `v0-gwa` + `docs/ops-go-live.md`  
**Date d’analyse :** 27 juillet 2026

---

## Verdict en une phrase

Le BP est **solide pour une Seed early** (narratif clair, discipline revenus, banques = partenaires, produit réel) — mais il a **3 écarts de crédibilité** à corriger avant envoi investisseur : grille de commissions ≠ code, numérotation F1–F6 ≠ docs techniques, et go-live paiement/SMS encore bloqués côté ops.

---

## 1. État des lieux — ce que dit le BP vs la réalité

### 1.1 Société & équipe

| Affirmation BP | État | Commentaire |
|----------------|------|-------------|
| SASU KOUAME Corporation, RCCM CI-ABJ-03-B17-00098, capital 1 M FCFA | À confirmer en annexe | OK si RCCM + statuts joints |
| CEO/CTO Kouamé + RT Makan Diabaté (contrat suspendu, 3 % equity au seuil 50 M) | Transparent | Point fort d’honnêteté ; risque key-person à documenter (vesting, cliff) |
| 2 stagiaires INP-HB (convention signée) | Affirmé | Joindre la convention en annexe |
| SIDONOBIEL 1 300+ producteurs | Ancrage clé | Joindre LOI / contrat / preuve visite |

### 1.2 Produit (bêta en production)

| Module BP | Affirmation | Réalité prod / code |
|-----------|-------------|---------------------|
| Commerce (catalogue, feed, messagerie, Digest) | Production | **OK** — PWA live, health healthy, SW offline `gwa-v20` |
| Smart Escrow | Production (paiement live en finalisation) | **Partiel** — logique escrow + webhook montant/idempotence en code ; `payment_url` FeexPay encore `null` (bloquant go-live commercial) |
| SCG v1 | Production, V2 packagée | **OK** lean — moteur v1 + snapshot affacturage ; v2/v3 post-bêta |
| Affacturage | Semi-manuel, hors revenu An.1 | **OK** — file admin approve/reject/disburse |
| Abonnements FREE/STARTER/PRO/ENTERPRISE | « Déjà implémentés techniquement » | **Partiel** — `subscription_tier` + frais selon palier en code ; **pas de billing / encaissement d’abo** visible |
| Commissions 0 / 4 / 5 / 6 / 8 % selon canal | Priorité n°1 | **Écart majeur** — voir §2 |

Prod (27 juil. 2026) : `/api/health` → `healthy`, DB connected, secrets OTP/OneSignal/SMS présents. Home & marketplace HTTP 200.

### 1.3 Numérotation F1–F6 — incohérence interne

| BP (Business Plan) | `docs/scope-beta.md` (repo) |
|--------------------|------------------------------|
| F1 Auth & profil | F1 Catalogue agri |
| F2 Catalogue | F2 Commandes / escrow |
| F3 Commande & escrow | F3 Profils / KYC |
| F4 SCG | F4 Notifications |
| F5 Messagerie | F5 Admin |
| F6 Back-office | F6 SCG |

**Risque diligence :** un investisseur technique lit les deux docs et voit une équipe qui ne parle pas le même langage. Unifier immédiatement.

### 1.4 Finance (hypothèses An.1)

| Indicateur (médian) | BP | Contrôle |
|---------------------|-----|----------|
| GMV An.1 | ≈ 269 M FCFA | Somme mensuelle = 269 — OK |
| Commissions | ≈ 13,45 M | Exactement **5 %** du GMV chaque mois |
| Abonnements | ≈ 7,85 M | Somme lignes mensuelles ≈ **7,3 M** — écart ~0,55 M |
| OPEX | ≈ 43,9 M | Somme lignes ≈ **42,0 M** — écart ~1,9 M |
| Résultat An.1 | ≈ −21,3 M (mensuel) / ≈ −23 M (table 3 ans) | **Deux chiffres différents** |
| Seed | 50 M plancher / 150 M cible | Cohérent avec burn An.1 si levée M7 |

Lecture : le modèle mensuel est **lisible et honnête** (creux de trésorerie à l’activation salariale M7). Les totaux et la table 3 ans doivent être recalés.

---

## 2. Analyse critique (forces / faiblesses)

### Forces

1. **Produit avant pitch** — « bêta déjà en production » est rare et crédible (URL + health).
2. **Discipline revenus 12 mois** — commissions + SaaS ; affacturage hors P&L An.1 = mature.
3. **Banques = partenaires, pas concurrents** — déjà bien écrit (§ concurrence + executive summary).
4. **Acquisition B2B2C coopératives** — CAC théorique bas, aligné terrain CI.
5. **Transparence équipe** — contrat suspendu + equity 3 % : plus crédible qu’une équipe « fantôme ».
6. **SWOT et risques** — réponses anticipées utiles (surtout dépendance FeexPay / partenaire financier).
7. **Use of funds** clair (30/35/20/10/5).

### Faiblesses / risques diligence

1. **Grille tarifaire BP ≠ code** (bloquant crédibilité)
   - BP : 0 % 1ʳᵉ vente · 4 % coop RCCM · 5 % virement · 6 % MM · 8 % export EUDR.
   - Code (`lib/pricing/service-fee.ts`) : frais **acheteur** selon abo — free **2,5 %** · starter 2 % · pro 1 % · business 0,5 % · enterprise 0,3 %.
   - Le P&L An.1 suppose un take rate **plat 5 %** — ni la grille canal, ni la grille code.
2. **Abonnements « implémentés »** = tiers + effet sur frais, **pas** de parcours de paiement d’abonnement.
3. **Go-live Sept. 2026** encore dépendant d’actions humaines : FeexPay live + SMS Africa’s Talking (voir `ops-go-live.md`).
4. **TAM 6 M producteurs** classique ; SAM/SOM trop flous (« quelques milliers ») pour un Seed exigeant.
5. **Concurrents non nommés** (agritech / MM / marketplaces ouest-africaines) — affaiblit la section marché.
6. **« Feexpay partenaire exclusif »** — à prouver par contrat ; sinon reformuler en « agrégateur principal ».
7. **Pas de cap table** post-Seed (dilution 50 vs 150 M, place des 3 % RT, option pool).
8. **Pas de métriques traction actuelles** (utilisateurs, SKU, GMV réel à date — même si ≈ 0).
9. **LTV PRO = 120 k** (10 k × 12) ignore churn et le fait que le PRO cible surtout des coopératives (peu de comptes).
10. **Années 2–3** (GMV 900 M → 2 Md) peu justifiées (nb coopératives, panier moyen, pays).

---

## 3. Suggestions d’amélioration (priorisées)

### P0 — Avant envoi investisseur (crédibilité)

| # | Action | Pourquoi |
|---|--------|----------|
| 1 | **Une seule grille de prix** : aligner BP, admin settings, et `lib/pricing/service-fee.ts` ; documenter « source de vérité » | Diligence technique cassera le dossier sinon |
| 2 | Recaler totaux An.1 (abo, OPEX, résultat) + harmoniser −21,3 vs −23 | Erreurs d’addition = signal négatif |
| 3 | Unifier **F1–F6** (BP = `scope-beta.md` = pitch) | Évite la confusion interne |
| 4 | Page « Traction à date » : users, coops, produits, commandes, GMV, uptime | Preuve > promesse |
| 5 | Statut go-live honnête : checklist FeexPay / OTP / abo commercial (vert / orange / rouge) | Cohérence avec « déjà en prod » |

### P1 — Renforcer le dossier Seed

| # | Action |
|---|--------|
| 6 | Cap table illustrative (pre / post 50 M et 150 M) + vesting RT (cliff 12 mois) |
| 7 | Nommer 4–6 concurrents / substituts ouest-africains + tableau « eux vs GWA » (escrow, SCG, agri-only) |
| 8 | Funnel An.1 : 3–5 coops → X producteurs actifs → Y GMV → take rate → abo payants (avec hypothèses) |
| 9 | Sensibilité : take rate 3 / 5 / 7 % et conversion abo 3 / 5 / 8 % (déjà partiel — lier au mensuel) |
| 10 | Escrow float / trésorerie séquestre : qui détient les fonds, délai, risque réglementaire BCEAO |
| 11 | Reformuler « exclusif Feexpay » → « principal / en production » sauf contrat signé |
| 12 | Annexer Excel (annoncé) + 1-pager teaser 2 pages séparé du BP long |

### P2 — Qualité narrative & ops

| # | Action |
|---|--------|
| 13 | Objectifs An.1 en **KPI mesurables** : MAU, GMV, #coops actives, NPS/litiges, uptime, % commandes escrow live |
| 14 | Plan B si Seed < 50 M (runway fondateur seul + stagiaires) — déjà esquissé, le chiffrer |
| 15 | ARTCI / registre données perso : statut de conformité (pas seulement citer la loi 2013-450) |
| 16 | Aligner le positionnement marketing : « marketplace qui **facilite** l’accès au crédit **via partenaires** » (déjà bon — le garder partout) |
| 17 | Versionner le BP (v1.1 post-corrections P0) avec date + changelog ½ page |

---

## 4. Score rapide (investisseur type early Seed)

| Critère | Note /5 | Commentaire |
|---------|---------|-------------|
| Clarté du problème / solution | 5 | Escrow + SCG + agri-only très clair |
| Différenciation | 4 | Combinaison rare ; manque concurrent nommé |
| Traction | 3 | Produit live oui ; GMV/users à date absents |
| Modèle économique | 3 | Bonne discipline ; grille ≠ code ; take rate plat |
| Équipe | 3,5 | Honnête ; key-person + RT suspendue |
| Marché | 3 | TAM ok ; SAM/SOM flous |
| Finances | 3,5 | Mensuel utile ; totaux à corriger ; Y2–Y3 légers |
| Risques | 4 | Bien traités ; go-live technique à expliciter |
| **Global** | **≈ 3,6 / 5** | **Investissable après P0** |

---

## 5. Recommandation

1. **Ne pas envoyer** le BP v23/07 tel quel à un investisseur technique sans P0.  
2. Produire une **v1.1** (grille unique + chiffres recalés + F1–F6 unifiés + traction + checklist go-live).  
3. En parallèle **ops** : brancher FeexPay `payment_url` + valider OTP SMS — sinon le « go-live Sept. 2026 » du BP est fragile.  
4. Garder tel quel : banques partenaires, focus commissions/abo An.1, SIDONOBIEL, transparence equity RT.

---

## Références repo

- Pricing réel : `lib/pricing/service-fee.ts`
- Go-live : `docs/ops-go-live.md`
- Scope F1–F6 technique : `docs/scope-beta.md`
- Cahier 12/24 mois : `docs/GWA_Cahier_des_Charges_12_24_Mois_Complet.docx` (si présent) / upload fondateur
- Positionnement banques : doctrine déjà dans le BP § concurrence (à maintenir)
