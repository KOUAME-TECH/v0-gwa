# Propositions UI/UX — dashboards & backoffice GWA

**Date :** 31 juillet 2026 · **Statut :** Sprint UI-1 → UI-3 **implémentés** (nav unifiée, homes rôles, admin file + abonnements)  
**Périmètre :** UI globale · dashboards acheteur / producteur / coop · admin  
**Sources code :** `app/dashboard/*`, `app/admin/*`, `components/dashboard-nav.tsx`, `app/profil`

---

## 1. Principes UI (tous les rôles)

| Principe | Règle |
|----------|--------|
| **1 job / écran** | Accueil rôle = 1 objectif du jour, pas un dashboard analytics |
| **Moins de cartes** | Stats max 2–3 ; le reste en liste / actions |
| **Empty states utiles** | Toujours 1 CTA clair (publier, explorer, inviter) |
| **Nav unique** | Même bottom bar partout (sauf admin) — finir les ruptures commandes/wallet |
| **Marque** | Vert `#1F5C2E` / crème `#FFF6E5` / accent `#C27D10` — éviter palettes bleues/violettes divergentes |
| **Mobile-first** | 1 colonne ; actions primaires au-dessus du fold |

---

## 2. UI/UX globale (app)

### Priorité haute

| # | Amélioration | Pourquoi |
|---|--------------|----------|
| **G1** | Unifier la navigation : `BottomNav` aussi sur `/dashboard/commandes`, `/wallet`, `/dashboard/products` | Aujourd’hui ces écrans perdent la barre → sentiment « app cassée » |
| **G2** | Lien Profil → « Mon espace » = `/dashboard` (redirect rôle) | Profil saute vers sous-pages, jamais l’accueil rôle |
| **G3** | Feed / avatar : router coop → `/dashboard/cooperative` (pas farmer) | Bug UX : coops atterrissent au mauvais espace |
| **G4** | Harmoniser détection vendeur (`DashboardNav` vs `BottomNav`) | Coop voit « Shop » au lieu de « Produits » |
| **G5** | Empty states standard (illustration courte + 1 CTA) | Buyer/farmer/coop ont des trous |

### Priorité moyenne

| # | Amélioration |
|---|--------------|
| **G6** | Indicateur d’onglet actif dynamique dans `DashboardNav` (plus de barre fixe) |
| **G7** | Toasts + feedback court après actions (invite copiée, retrait demandé, abo) |
| **G8** | Mode data-saver visible (toggle) sur marketplace / feed |
| **G9** | Skeleton loaders cohérents (déjà partiels) sur tous les dashboards |

---

## 3. Dashboard Acheteur (`/dashboard/buyer`)

**Job de l’écran :** « Où en sont mes achats ? » + « Continuer à acheter ».

### Propositions

| # | Amélioration |
|---|--------------|
| **A1** | **Hero simple :** « Bonjour {prénom} » + 1 CTA principal « Continuer mes achats » → marketplace |
| **A2** | Remplacer 4 cartes stats par **2 chiffres max** : commandes en cours · à confirmer (escrow) |
| **A3** | Bloc **« À faire »** : commandes `held` en attente de confirmation réception (action escrow) |
| **A4** | Empty state commandes : CTA « Explorer le marché » (pas une page vide) |
| **A5** | Favoris → lien « Voir tout » vers `/favoris` (pas `/agriculture`) |
| **A6** | Retirer / clarifier Wallet côté acheteur (aujourd’hui logique vendeur) — ou page « Mes paiements » |
| **A7** | Masquer pills redondantes si déjà dans la bottom nav |

**À éviter :** grille « Pour vous » + historique + favoris + 4 stats sur le premier viewport.

---

## 4. Dashboard Producteur (`/dashboard/farmer`)

**Job :** « Publier / vendre / voir l’argent qui arrive ».

### Propositions

| # | Amélioration |
|---|--------------|
| **P1** | **Réduire le fold :** garder header + 1 bandeau (météo *ou* SCG coach, pas les deux) + 2 stats + 2 CTA |
| **P2** | CTA primaires fixes : **Publier** · **Commandes à traiter** (badge pending) |
| **P3** | Stats : Free = produits + commandes ; Starter+ = net + vues (déjà partiel — clarifier le paywall) |
| **P3b** | Bloc abo compact : palier + **Yelly X/limite** + lien `/abonnement` (avantages du palier suivant) |
| **P4** | Empty commandes : CTA « Partager mon annonce » / « Voir ma boutique » |
| **P5** | Affacturage : carte compacte seulement si SCG proche du seuil ou déjà éligible |
| **P6** | Raccourci Wallet + Abonnement dans le header (icônes), pas 4 cartes financières |
| **P7** | Liste produits : statut stock bas / offline pending outbox |

**Composition 1er viewport cible :**  
Marque/prénom · 1 phrase · [Publier] [Commandes] · 2 stats · liste « À traiter ».

---

## 5. Dashboard Coopérative (`/dashboard/cooperative`)

**Job :** « Qualifier la coop + faire rejoindre des membres ».

### Propositions

| # | Amélioration |
|---|--------------|
| **C1** | **Checklist qualification** visuelle (membres 15/14j · docs · statut) — pas 3 bandeaux texte |
| **C2** | **Une seule zone Invite** (supprimer doublon quick action + carte + bouton liste) |
| **C3** | Compteur membres « X / 15 » avec barre de progression |
| **C4** | Rôles admin/manager : badge clair + actions limitées selon rôle |
| **C5** | Vue « Catalogue coop » (produits des membres) — aujourd’hui partial |
| **C6** | Empty state sans coop : 2 chemins « Créer » / « Rejoindre » (pas seulement créer) |
| **C7** | Alerte docs légaux → CTA upload / contact support (pas lien profil seul) |

---

## 6. Backoffice Admin (`/admin`)

**Job par rôle :** super_admin (tout) · moderator (contenu) · support (tickets/litiges).

### Accueil `/admin`

| # | Amélioration |
|---|--------------|
| **B1** | **File « À traiter aujourd’hui »** en haut : produits pending · vérifs · litiges · support · affacturage · demandes abo |
| **B2** | Remplacer KPIs décoratifs par **compteurs actionnables** (cliquables → filtre) |
| **B3** | Alerte santé ops : FeexPay configuré ? SMS ready ? (lire `/api/health`) |

### Par module

| Module | Optimisation UI |
|--------|-----------------|
| **Users** | Filtres type/statut ; action « forcer type » (admin only) clairement loguée |
| **Produits** | Queue modération type Tinder/liste : Approuver / Rejeter + motif |
| **Commandes** | Colonnes escrow + payout_status ; filtre « stuck processing » |
| **Finances** | Utiliser `commission_fcfa` réel ; graphe held vs released |
| **Coops** | Passer de lecture seule → valider docs / statut qualification |
| **Support** | SLA badge (nouveau / >24h) ; réponse template |
| **Litiges** | Timeline + freeze payout visible |
| **Affacturage** | Trier par `queue_priority` (déjà API) + badge palier abo |
| **Abo** | Écran dédié `subscription_requests` (activer / rejeter) — manque aujourd’hui |
| **Yelly** | Métrique usage / jour par palier (détection abus + coût Gemini) |
| **Analytics** | Couper RFQ/courses hors scope ; garder agri + escrow + abo |

### UX shell admin

| # | Amélioration |
|---|--------------|
| **B4** | Mobile : drawer sidebar (pas sidebar fixe illisible) |
| **B5** | Breadcrumb + retour contexte (ex. depuis alerte → liste filtrée) |
| **B6** | Confirmations destructives uniformes (suspendre, rejeter, rembourser) |

---

## 7. Parcours transverses à soigner

| Parcours | UX proposée |
|----------|-------------|
| **Escrow acheteur** | Dashboard buyer → carte « Confirmer réception » en 1 tap |
| **Escrow vendeur** | Farmer → « Fonds en séquestre / libérés » statut clair |
| **Abonnement** | Après upgrade : retour dashboard avec badge palier + **bénéfices débloqués** (commission, stats, boost…) **et nouveau plafond Yelly** |
| **Yelly** | Compteur « X / limite restant aujourd’hui » dans le panneau ; à 0 → CTA upgrade palier (pas seulement WhatsApp) |
| **OTP / 1ʳᵉ pub** | Onboarding : 3 étapes max (type → profil → publier) |
| **Offline** | Bandeau « En attente d’envoi (N) » sur Publier + dashboard |

---

## 8. Priorisation recommandée (UI)

### Sprint UI-1 (navigation & cohérence)
G1 · G2 · G3 · G4 · A6 (wallet acheteur)

### Sprint UI-2 (homes rôles + Yelly / abo)
P1–P4 · P3b · A1–A4 · C1–C3 · compteur Yelly + page `/abonnement` (avantages **et** limites Yelly par palier)

### Sprint UI-3 (admin actionnable)
B1 · B2 · écran abo admin · commandes stuck · coops validation · usage Yelly

---

## Annexe — Avantages & plafonds Yelly (ne pas oublier)

| Palier | Avantages clés | Yelly / jour |
|--------|----------------|--------------|
| Invité | Découverte | 3 |
| Free | 5 annonces, SCG base, digest | 10 |
| Starter | Illimité, boost, stats | 40 |
| Pro | Priorité feed, badge, SCG avancé, affacturage, reporting | 120 |
| Enterprise | Multi-managers, AM, reporting | illimité |

Toute carte pricing / dashboard / empty-state upgrade doit citer **les deux** : bénéfices **et** quota Yelly.  
Source : `lib/pricing/entitlements.ts` · détail ops : `docs/yelly-gemini.md`.

---

## 9. Ce qu’il ne faut pas faire

- Transformer les homes en **cockpit analytics** (trop de cards)
- Ajouter un 4ᵉ système de nav
- Dashboard « entreprise / student / artisan » séparés (hors scope)
- Dark mode / redesign purple — rester sur la marque GWA

---

## 10. Maquettes mentales (1er viewport)

**Acheteur**  
`Bonjour Awa` · *1 commande à confirmer* · [Confirmer] · [Boutique]

**Producteur**  
`Espace producteur` · [Publier] [3 commandes] · Net 120k · 4 produits

**Coop**  
`SIDONOBIEL` · Progression membres **8/15** · [Inviter] · Checklist docs

**Admin**  
`À traiter : 4` · Produits(2) Litiges(1) Abo(1) · Santé : SMS ✗ FeexPay ✗

---

*Doc produit UI — à croiser avec `docs/propositions-ameliorations-optimisations.md` (ops/paiement) et `docs/brand.md`.*
