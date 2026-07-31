# Propositions d’améliorations — vague 2 (autonomes)

**Date :** 31 juillet 2026  
**Statut :** **VALIDÉE** — implémentation agent en cours / partielle (Yelly Ops inline, perso acheteur/producteur, ConfirmDestructive, copy escrow).  
**Objectif :** backlog que l’agent peut **implémenter sans toi** (pas de clés Vercel, pas d’approbation Sender ID, pas de décision DG).  
**Déjà livré :** **Yelly Ops** + quotas · assist inline produits/support/litiges · dashboards perso B/P · v3 backlog.

---

## 0. Règle d’or

| Faisable sans toi | Bloqué chez toi / ops |
|-------------------|------------------------|
| UI, empty states, copy, routing, entitlements, templates, tests | `FEEXPAY_*`, `AT_SENDER_ID`, HIBP Auth Dashboard, WhatsApp business |
| Quotas IA, prompts, files admin, personnalisation dashboards | Contrats banques / IMF, pricing DG |

---

## 1. IA backoffice (Yelly Ops) — suite

**Socle livré**

| Rôle admin | Quota IA / jour | Tâches |
|------------|-----------------|--------|
| moderator | 40 | modération, support |
| support | 60 | support, litiges |
| admin | 120 | tout |
| super_admin | illimité | tout |

### À implémenter ensuite (sans toi)

| # | Proposition | Où |
|---|-------------|-----|
| **AI1** | Bouton « Demander à Yelly Ops » inline sur `/admin/products` (préremplit contexte produit) | 1 clic → brouillon rejet/approbation |
| **AI2** | Idem sur `/admin/support` (préremplit ticket) | Réponse template personnalisée |
| **AI3** | Idem litiges + affacturage + coops | Résumé + checklist |
| **AI4** | Compteur usage IA sur home admin (« Ops IA : 12/120 ») | Transparence coût |
| **AI5** | Templates prompts FR stockés dans `lib/admin/ai-templates.ts` | Cohérence ton GWA |
| **AI6** | Log `source: admin-assist` déjà en DB → mini analytics admin « top tâches IA » | Pilotage |

---

## 2. Personnalisation poussée par type d’utilisateur

### 2.1 Acheteur retail (`acheteur`)

| # | Proposition autonome |
|---|----------------------|
| **B1** | Accueil : 1 produit « près de toi » (même `city` / région) au-dessus des favoris |
| **B2** | Rappel soft si commande `held` > 48h sans confirmation (bandeau dashboard + notif in-app) |
| **B3** | Suggestions Yelly acheteur : « Où est ma commande ? », « Confirmer réception », « Contacter vendeur » (pas « Publier ») |
| **B4** | Mode « première commande » : checklist 3 steps (explorer → panier → payer) jusqu’à 1ʳᵉ commande delivered |
| **B5** | Favoris vides → 4 produits populaires de sa ville (query simple) |

### 2.2 Producteur (`producteur`)

| # | Proposition autonome |
|---|----------------------|
| **P1** | Home : prochaine action unique (publier si 0 produit · traiter si pending · partager si stock) |
| **P2** | Badge stock bas + CTA « Mettre à jour stock » inline liste produits |
| **P3** | Yelly producteur : suggestions « Commission de mon palier », « Comment monter SCG », « Demander affacturage » |
| **P4** | Carte « Ce que ton palier débloque » (1 bénéfice manquant + CTA abo) — Free vs Starter |
| **P5** | Après publication : écran succès + partage WhatsApp prérempli (texte local) |
| **P6** | Liste commandes vendeur : filtre « En séquestre » / « À préparer » |

### 2.3 Coopérative (`cooperative`)

| # | Proposition autonome |
|---|----------------------|
| **C1** | Timeline qualification (J0 → J14) avec jours restants calculés |
| **C2** | Liste membres : filtre rôle + recherche nom |
| **C3** | Catalogue coop : page `/dashboard/cooperative/catalogue` = produits des `cooperative_members` |
| **C4** | Yelly coop : « Comment inviter 15 membres », « Docs légaux requis », « Multi-managers Enterprise » |
| **C5** | Alerte si membre inactif (0 produit) > 14 j — liste actionnable |
| **C6** | Share sheet invite : texte WhatsApp + SMS `sms:` link |

### 2.4 Entreprise / acheteur B2B (`entreprise`)

| # | Proposition autonome |
|---|----------------------|
| **E1** | Dashboard buyer variant : titre « Desk achats » + CTA « Demander devis Enterprise » |
| **E2** | Masquer « Publier » partout (déjà `isSellerRole` false) — vérifier feed empty + profil |
| **E3** | Yelly B2B : « Volume / facture », « Compte multi-users », contact ops |

### 2.5 Admin / ops (tous rôles backoffice)

| # | Proposition autonome |
|---|----------------------|
| **A1** | Home filtrée par rôle (moderator ne voit que produits/reports) — déjà partiel via nav |
| **A2** | Raccourcis clavier : `g p` produits, `g s` support (desktop) |
| **A3** | Confirmations destructives uniformes (composant `ConfirmDestructive`) |
| **A4** | Drawer mobile sidebar (si pas assez fluide) + breadcrumb |
| **A5** | Yelly Ops inline (AI1–AI3) |

---

## 3. Produit / UX transverses (autonomes)

| # | Proposition |
|---|-------------|
| **X1** | Composant `RoleGate` : empty state + CTA si mauvais type sur une page |
| **X2** | Onboarding post-OTP : 3 écrans max selon `user_type` (déjà partiel — durcir) |
| **X3** | Toasts standardisés (invite copiée, retrait demandé, abo envoyé) |
| **X4** | Bandeau offline outbox « N publications en attente » sur `/publier` + farmer |
| **X5** | Data-saver toggle (localStorage) : images LQ + moins de prefetch |
| **X6** | Accessibilité : `aria-live` sur toasts Yelly + focus trap panneau |
| **X7** | Page `/abonnement` : tableau comparatif avantages **+** Yelly 10/40/120/∞ (déjà en benefits — ajouter tableau visuel) |
| **X8** | Escrow copy acheteur/vendeur unifiée (« Argent protégé ») dans commandes |
| **X9** | Tests Playwright smoke : login mock → dashboard rôle → bottom nav visible |
| **X10** | Nettoyage analytics admin : retirer RFQ/courses hors scope (CdC) |

---

## 4. Confiance / SCG / messages (autonomes)

| # | Proposition |
|---|-------------|
| **T1** | Coach SCG Free : 1 tip seulement ; Pro : panel complet (déjà partiel farmer) |
| **T2** | Messages : empty state « Écris au vendeur depuis une fiche produit » |
| **T3** | Profil public : badge Pro + score SCG discret (pas de PII téléphone) |
| **T4** | Digest : CTA « Écouter » plus visible si `digestLocal` entitlement |

---

## 5. Backoffice fichiers / files (autonomes)

| # | Proposition |
|---|-------------|
| **BO1** | Commandes : filtre `escrow_status=held` + `payout_status` stuck |
| **BO2** | Produits : file type « Approuver / Rejeter » + motif obligatoire si rejet |
| **BO3** | Users : filtre `user_type` + `subscription_tier` |
| **BO4** | Finances : afficher `commission_fcfa` agrégé période |
| **BO5** | Export CSV déjà partiel — boutons visibles sur users/orders/products |
| **BO6** | Page abo admin : filtre + recherche téléphone (déjà activer/rejeter) |

---

## 6. Ordre d’exécution recommandé (agent seul)

### Sprint A — IA ops utile
AI1 · AI2 · AI4 · AI5

### Sprint B — Perso acheteur + producteur
B1–B4 · P1–P5 · X7 · X8

### Sprint C — Perso coop + B2B
C1–C6 · E1–E3

### Sprint D — Backoffice files
BO1–BO5 · A3 · X10

---

## 7. Hors scope volontaire (ne pas démarrer sans toi)

- Config FeexPay / SMS Sender ID / HIBP
- Nouveaux prix abo / commissions
- Multi-pays, formations, social hors agri
- Promesse séquestre bancaire

---

## 8. Références code

| Sujet | Fichiers |
|-------|----------|
| Quotas vendeur Yelly | `lib/pricing/entitlements.ts` |
| Quotas IA admin | `lib/admin/ai-entitlements.ts` |
| API Yelly Ops | `app/api/admin/ai/assist/route.ts` |
| UI Yelly Ops | `app/admin/ai/page.tsx` |
| Homes rôles | `app/dashboard/{buyer,farmer,cooperative}` |

*Croiser avec `propositions-ui-ux-dashboards.md` (livré) et `propositions-ameliorations-optimisations.md` (ops P0).*
