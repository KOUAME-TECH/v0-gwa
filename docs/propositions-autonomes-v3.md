# Propositions d’améliorations — vague 3 (autonomes)

**Date :** 31 juillet 2026  
**Statut v2 :** **VALIDÉE** par la DG / produit — en cours d’implémentation agent.  
**Objectif v3 :** encore plus d’items **implémentables sans toi**.

---

## 0. Ce que « sans toi » signifie

OK : code, copy, UX, tests, templates, quotas, filtres, empty states, IA prompts.  
NOK : clés Vercel, Sender ID, HIBP dashboard, prix, contrats partenaires.

---

## 1. Croissance & activation (sans ops)

| # | Proposition |
|---|-------------|
| **G1** | Checklist onboarding persistée `localStorage` par `user_type` (3 étapes) |
| **G2** | Bannière « Invite un producteur » (coop) avec compteur viral simple |
| **G3** | Deep-link `/publier?from=feed` → toast succès + retour feed |
| **G4** | Carrousel « Comment ça marche » 3 slides (acheteur / vendeur) 1ʳᵉ visite |
| **G5** | Score d’activation profil (photo + ville + bio) % dans `/profil` |
| **G6** | Empty feed personnalisé par heure (matin / soir) copy FR |
| **G7** | CTA sticky marketplace « Filtrer près de moi » si géoloc refusée → ville profil |

---

## 2. Commandes & escrow (UX only)

| # | Proposition |
|---|-------------|
| **O1** | Timeline visuelle 4 étapes (payé → préparé → expédié → confirmé) |
| **O2** | Timer soft « Confirme sous 48h » côté acheteur (UI only) |
| **O3** | Vendeur : badge « Fonds en séquestre » vs « Libérés » sur chaque carte |
| **O4** | Motifs de litige prédéfinis (qualité / quantité / non-réception / autre) |
| **O5** | Photo preuve réception : rappel si absente (copy + lien) |
| **O6** | Filtre commandes : Tous / À faire / Séquestre / Terminées (acheteur + vendeur) |

---

## 3. Catalogue & publish

| # | Proposition |
|---|-------------|
| **K1** | Suggestions prix médian catégorie (si ≥3 produits actifs même type) |
| **K2** | Checklist publish : photo · prix · stock · ville (barre progression) |
| **K3** | Draft localStorage auto-save `/publier` |
| **K4** | Tags rapides (bio, local, gros) chips |
| **K5** | Prévisualisation fiche avant submit |
| **K6** | Après publish : share WhatsApp + « Voir ma boutique » (P5) |

---

## 4. Messages & notifications

| # | Proposition |
|---|-------------|
| **M1** | Templates message rapide vendeur (« Dispo », « Prix négociable », « Livraison demain ») |
| **M2** | Badge non-lus déjà OK — ajouter « Marquer tout lu » |
| **M3** | Empty messages différencié acheteur vs vendeur |
| **M4** | Préférence digest in-app (toggle profil) stockée profile JSON / localStorage |
| **M5** | Centre notifs : grouper par type (commande / message / système) |

---

## 5. SCG & confiance

| # | Proposition |
|---|-------------|
| **S1** | Page `/scg` : 1 tip Free vs radar Pro (entitlement `scgAdvanced`) |
| **S2** | Historique score (sparkline si `scg_scores` multi-lignes) |
| **S3** | Explainer « Pourquoi mon score » 5 phrases FR |
| **S4** | Badge bancable → CTA affacturage seulement si éligible (déjà partiel) |

---

## 6. Abonnements (UI entitlements)

| # | Proposition |
|---|-------------|
| **AB1** | Tableau comparatif visuel Free/Starter/Pro/Ent + ligne Yelly |
| **AB2** | Sur farmer : carte « Passe Starter → stats + 40 Yelly/j » |
| **AB3** | Après demande abo : état « En attente activation » sur dashboard |
| **AB4** | Admin abo : recherche téléphone + filtre tier |

---

## 7. Backoffice (suite IA + files)

| # | Proposition |
|---|-------------|
| **BO7** | Bouton Yelly Ops sur factoring + cooperatives (AI3) |
| **BO8** | Motif rejet produit obligatoire (validation UI) |
| **BO9** | Filtres commandes stuck : `payment_status=paid` + `escrow=held` > 7j |
| **BO10** | `ConfirmDestructive` partagé (suspendre user, rejeter abo, spam) |
| **BO11** | Raccourcis clavier desktop admin (g+p, g+s, g+a) |
| **BO12** | Export CSV visible users/orders/products (si API existe) |
| **BO13** | Analytics : retirer modules hors scope (RFQ/courses) |
| **BO14** | Compteur quota IA live sur home (GET `/api/admin/ai/assist`) |

---

## 8. Performance PWA (sans infra)

| # | Proposition |
|---|-------------|
| **PF1** | Data-saver toggle (localStorage) skip images > 1ʳᵉ |
| **PF2** | Skeleton partout loading.tsx encore `null` |
| **PF3** | Prefetch `/dashboard` au hover « Mon espace » |
| **PF4** | Lazy heavy admin charts |
| **PF5** | Offline banner outbox count sur publier |

---

## 9. Accessibilité & i18n light

| # | Proposition |
|---|-------------|
| **A11y1** | Focus trap Yelly panel |
| **A11y2** | Contrastes badges amber/vert vérifiés |
| **A11y3** | Labels FR manquants `aria-label` sur icon-only buttons |
| **I18N1** | Dictionnaire copy escrow centralisé `lib/copy/escrow-fr.ts` |

---

## 10. Qualité / dette

| # | Proposition |
|---|-------------|
| **Q1** | Playwright smoke : 3 dashboards + bottom nav |
| **Q2** | Vitest templates Yelly Ops + role suggestions (étendre) |
| **Q3** | Script `npm run check:scope` grep hors-agri (formations/artisan) |
| **Q4** | Storybook-less : page `/dev/ui-kit` EmptyState / badges (dev only) |

---

## 11. Ordre agent (après v2)

1. Finir v2 Sprint A–D  
2. Vague 3 : O1–O6 · K2–K6 · AB1–AB3 · BO8–BO14 · PF1–PF2  
3. Puis G1–G7 · M1–M5 · S1–S3 · Q1–Q2  

---

*Index : `docs/README.md` · v2 : `propositions-autonomes-v2.md`*
