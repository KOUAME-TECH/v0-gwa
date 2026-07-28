# Politique GWA — Types de compte & qualification des coopératives

**Statut :** Règle produit officielle — 28 juil. 2026  
**Périmètre :** Business plan §II / §IV · Cahier des charges · CGU / règlement interne  
**Compléments :** pricing `decision-strategique-pricing-gwa-2026-07-28.md` · escrow FeexPay · banques = partenaires

---

## 1) Explication stratégique

### Pourquoi cette règle
GWA vend de la **confiance** (escrow, SCG, données terrain). Un compte « coopérative » créé seul, sans membres ni pièces, dilue cette confiance, fausse le SCG et fragilise les futurs partenariats bancaires / IMF.

### Problèmes résolus
- Comptes coop fictifs ou mono-utilisateur se faisant passer pour une structure  
- Changement opportuniste de type de compte (acheteur → coop → producteur) pour contourner les règles  
- Données membres / volumes non auditables pour l’affacturage et le scoring  

### Amélioration plateforme
- Qualification **progressive** : on n’étouffe pas l’adoption (fonctions de base ouvertes)  
- Incitation claire : 15 membres en 14 jours = signal d’activité réelle  
- Documents sous 6 mois = sérieux juridique sans freiner le démarrage  

### Protection business model
- Commission + abo reposent sur de **vraies** structures actives  
- SCG et deal flow pour les banques restent crédibles  
- Support / admin pilotent les changements de statut (pas le self-service)

---

## 2) Politique produit claire

| Élément | Règle |
|---------|--------|
| **Statut initial** | Toute nouvelle coopérative = **« Coopérative en validation »** (`pending_validation`) |
| **Seuil membres** | **≥ 15 utilisateurs actifs** rattachés à la coop |
| **Délai membres** | **14 jours** après inscription / création de la fiche |
| **Documents légaux** | Dépôt des pièces (RCCM, statuts, etc.) dans les **6 mois** |
| **Restrictions** | À partir du **mois 3**, si conditions non remplies → **fonctions avancées limitées** |
| **Fonctions de base** | Restent accessibles pendant la transition (vitrine, messagerie, publication simple, ajout de membres) |
| **Type de compte** | **Aucun changement libre** ; toute modification = **validation interne GWA** (support / admin) |

**Fonctions de base (maintenues) :** profil / vitrine, invitations membres, messagerie, catalogue simple, suivi commandes basique.  
**Fonctions avancées (restreintes si non conforme dès M3) :** priorité affacturage, outils multi-rôles étendus, badge coop vérifiée, boosts / accès Enterprise coop.

---

## 3) Texte prêt à insérer (Business plan / Cahier des charges)

### Qualification progressive des comptes coopératifs

GWA distingue les comptes individuels (producteur, acheteur) des comptes coopératifs. Le type de compte est fixé à l’inscription ou lors de la création contrôlée d’une fiche coopérative ; il ne peut pas être modifié en libre-service. Toute demande de changement (par exemple d’acheteur vers coopérative) fait l’objet d’une validation interne par l’équipe GWA.

Lors de sa création, une coopérative obtient le statut « Coopérative en validation ». Elle dispose d’un accès aux fonctionnalités de base afin de démarrer son activité sur la plateforme. Pour progresser vers un statut pleinement qualifié, elle doit :

1. rattacher au moins quinze (15) utilisateurs actifs dans un délai de quatorze (14) jours suivant l’inscription ;  
2. déposer ses documents légaux dans un délai de six (6) mois suivant l’inscription.

À compter du troisième mois, si ces conditions ne sont pas remplies, GWA applique des restrictions progressives portant uniquement sur les fonctionnalités avancées (outils de financement prioritaire, options multi-rôles étendues, signaux de confiance renforcés). Les fonctionnalités de base restent disponibles afin de permettre à la structure de régulariser sa situation sans interruption brutale du service.

Cette politique vise à garantir que les comptes coopératifs correspondent à des organisations agricoles réelles, à protéger la qualité des données utilisées par le Score de Confiance GWA (SCG), et à préparer des partenariats financiers responsables avec les banques et institutions de microfinance — partenaires de GWA, et non concurrents.

---

## 4) Tableau des phases

| Phase | Délai | Condition | Conséquence | Niveau d’accès |
|-------|-------|-----------|-------------|----------------|
| Inscription | J0 | Création fiche coop | Statut « en validation » | Basic |
| Activation membres | J0 → J14 | ≥ 15 membres actifs | Progression qualification | Basic → Standard |
| Restriction progressive | Mois 3+ | Membres et/ou docs manquants | Avancé limité ; base ouverte | Restricted advanced |
| Documents légaux | Avant mois 6 | Pièces déposées | Éligibilité « qualifiée » / badge | Full |
| Qualifiée | Après conformité | Membres + docs (ou validation admin) | Accès complet | Full |

---

## 5) Règlement interne (version courte)

**RI-COOP-01 — Qualification des coopératives**

1. Une coopérative démarre en **validation**.  
2. Elle doit avoir **15 membres actifs sous 14 jours**.  
3. Elle doit déposer ses **documents légaux sous 6 mois**.  
4. Dès le **mois 3**, sans conformité : **avancé restreint**, **base maintenue**.  
5. Le **type de compte est verrouillé** ; seul le support / admin GWA peut le modifier après contrôle.

**RI-ACCOUNT-01 — Type de compte**

Le type de compte (producteur, acheteur, coopérative) est choisi à l’entrée sur GWA. Il n’est pas modifiable depuis les paramètres du profil. Les demandes exceptionnelles passent par le canal support et une validation humaine.

---

## Implémentation technique (repo)

| Élément | Emplacement |
|---------|-------------|
| Règles calculatoires | `lib/cooperatives/validation-policy.ts` |
| Migration colonnes + gel `user_type` | `scripts/schema/049_coop_validation_account_lock.sql` |
| Création coop contrôlée | `POST /api/cooperatives` |
| Profil : type en lecture seule | `app/profil/edit/page.tsx` |
| API profil : `user_type` retiré du PATCH | `app/api/profiles/[id]/route.ts` |

**À appliquer en base :** exécuter la migration `049` sur Supabase prod.

---

## Yelly / Gemini

Yelly utilise l’API Gemini (`gemini-flash-latest`) via la variable d’environnement **`GEMINI_API_KEY`** (ou `GOOGLE_GENERATIVE_AI_API_KEY`) sur Vercel — **jamais** de clé en dur dans le dépôt.

---

**Recommandation finale :** adopter cette politique de qualification progressive telle quelle — assez souple pour l’adoption terrain, assez stricte pour la crédibilité SCG et les partenaires financiers.

**Pourquoi c’est la meilleure version pour GWA :** elle protège la confiance sans punir les vraies coopératives, verrouille les abus de type de compte, et reste défendable devant un investisseur, une coop et un comité de direction.
