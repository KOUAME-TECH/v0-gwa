# Checklist UX bêta GWA — 10 points

**Cible :** 1er septembre 2026  
**Scope produit :** F1–F6 ([scope-beta.md](./scope-beta.md))  
**Principe :** si ces 10 points sont **vrais et vérifiables sur le terrain**, GWA est clairement au-dessus d’une marketplace classique pour un public rural (simplicité, confiance, audio inclusif, preuve financière).

Ce document est un **outil de priorisation produit**, pas une spec technique.  
Références croisées : [beta-test-matrix.md](./beta-test-matrix.md), [ops-go-live.md](./ops-go-live.md).

---

## 1. Contexte

GWA a déjà une avance réelle côté architecture (escrow Feexpay, SCG, PWA, Harmattan Wave / Digest / langues locales).  
Ce qui manque pour être **clairement supérieur** aux plateformes classiques :

1. **Ancrage terrain** (script animateur + pilote coop + métriques)
2. **Simplicité radicale** côté utilisateur rural (accueil, nav, parcours héros)
3. **Preuve** de valeur financière et sociale (escrow lisible, coach SCG, avance compréhensible)

Grille de profondeur UX (6 couches) utilisée pour dériver les 10 points :

| Couche | Question |
|--------|----------|
| Entrée | Comment quelqu’un découvre et fait confiance ? |
| Navigation | Peut-il se repérer en 3 gestes ? |
| Tâches critiques | Vente / paiement / avance réussies du 1er coup ? |
| Émotion | Se sent-il respecté, pas jugé ? |
| Hors écran | Support + formation terrain ? |
| Mesure | Sait-on si ça marche vraiment ? |

---

## 2. État actuel vs cible (synthèse code — 21 juil. 2026)

| Zone | Aujourd’hui | Cible bêta |
|------|-------------|------------|
| Accueil `/` | Feed social (Instagram-like) | ≤3 blocs problème → solution + audio |
| Nav | 5 onglets (Feed / Shop / Chat / Moi + FAB) | ≤3 : Marché / Messages / Moi |
| Publier | `/publier` riche + `/dashboard/products/new` | 1 écran Photo + Audio + Prix + Quantité |
| Escrow | APIs OK ; UX panier/confirmation silencieuse | Stepper Payer → Séquestre → … → Libéré |
| Affacturage | Formulaire + éligibilité SCG ≥ 500 | + audio pédagogique « à quoi sert / quand rembourser » |
| SCG | Gauge + 5 dimensions (`/scg`) | Coach : score + 2 actions + ton non culpabilisant |
| Audio | Ondes, Mode écoute, Digest, langues | Contrôle + résumé + « voir le texte » ; auto-play non intrusif |
| Support | WhatsApp via `/contact` | Bouton global « Parler à quelqu’un » (template pré-rempli) |
| Offline | PWA shell (`sw.js`) | Mode limité utile (voir / écouter / brouillon offre) |
| Preuve terrain | Matrice 7 profils documentée | ≥1 coop pilote + script + métriques coché |

---

## 3. Checklist 10 points

Légende statut : **fait** · **partiel** · **manquant**

### Point 1 — Accueil orienté problèmes concrets

| | |
|--|--|
| **Statut** | **manquant** |
| **Critère de succès** | Sur le premier écran (ou avant le feed), ≤3 blocs cliquables du type : « Vendre et être payé à temps », « Demander une avance », « Suivre mon score ». Chaque bloc a un audio « Me l’expliquer ». |
| **Comment cocher** | Ouvrir l’app en session neuve (sans compte). En 10 s, un animateur peut expliquer les 3 promesses sans scroller le feed. |
| **Preuve** | Capture + audio d’accueil enregistré. |
| **Ancrage code** | [`app/page.tsx`](../app/page.tsx) = feed ; onboarding rôle = [`app/auth/onboarding/page.tsx`](../app/auth/onboarding/page.tsx). |
| **Dépendances** | Copy FR simple ; évent. assistant Harmattan (TTS). |

### Point 2 — Navigation rurale ≤ 3 onglets

| | |
|--|--|
| **Statut** | **manquant** |
| **Critère de succès** | Barre basse = **Marché** · **Messages** · **Moi** (libellés FR). Back-office hors nav grand public. Publier accessible depuis Marché ou Moi, pas comme 5ᵉ onglet. |
| **Comment cocher** | Demander à un utilisateur rural de « trouver ses messages » et « voir son activité » sans aide : ≤2 essais. |
| **Preuve** | Capture nav + test 5 utilisateurs. |
| **Ancrage code** | [`components/bottom-nav.tsx`](../components/bottom-nav.tsx) (5 items + FAB). |
| **Dépendances** | Décision IA : où vit le feed social (onglet Marché secondaire, ou après onboarding). |

### Point 3 — Parcours Vente ultra court

| | |
|--|--|
| **Statut** | **partiel** |
| **Critère de succès** | Un producteur publie une offre en **un seul écran** : Photo + Audio + Prix + Quantité. Feedback immédiat texte + audio : « Ton offre est publiée ». |
| **Comment cocher** | Chronométrer 5 publications terrain ; médiane &lt; 90 s ; 0 abandon sur l’écran. |
| **Preuve** | Vidéo terrain + produit visible sur marketplace. |
| **Ancrage code** | [`app/publier/page.tsx`](../app/publier/page.tsx) (riche) ; [`app/dashboard/products/new/page.tsx`](../app/dashboard/products/new/page.tsx) (classique). |
| **Dépendances** | Harmoniser les 2 UIs ; compress image déjà en place. |

### Point 4 — Escrow lisible au paiement

| | |
|--|--|
| **Statut** | **partiel** (backend) / **manquant** (UX) |
| **Critère de succès** | Pendant et après paiement, l’acheteur voit clairement : *« Tu paies maintenant ; le vendeur touche l’argent après confirmation de livraison. »* Stepper : Payer → Séquestre → Livré → Confirmé → Libéré. Mention Feexpay CI (agrégateur licencié). |
| **Comment cocher** | Parcours acheteur test : à chaque statut, le libellé escrow est compréhensible sans lire les CGU. |
| **Preuve** | Captures panier + confirmation + liste commandes. |
| **Ancrage code** | APIs [`app/api/orders/`](../app/api/orders/) ; UI [`app/panier/page.tsx`](../app/panier/page.tsx), [`app/commandes/confirmation/page.tsx`](../app/commandes/confirmation/page.tsx). |
| **Dépendances** | Compte merchant Feexpay live (ops — voir scope-beta). |

### Point 5 — Avance sur facture pédagogique

| | |
|--|--|
| **Statut** | **partiel** |
| **Critère de succès** | Écran court : éligibilité SCG en langage clair (« Ton score est 540, dossier suffisant ») + audio « À quoi sert l’avance / quand rembourser » + envoi en ≤3 champs. |
| **Comment cocher** | Producteur SCG ≥ 500 complète une demande sans aide admin ; producteur &lt; 500 comprend *pourquoi* et *quoi faire*. |
| **Preuve** | Demande visible dans `/admin/factoring`. |
| **Ancrage code** | [`app/affacturage/page.tsx`](../app/affacturage/page.tsx), [`lib/factoring/eligibility.ts`](../lib/factoring/eligibility.ts). |
| **Dépendances** | Script audio FR (et langue locale si voix communautaire). |

### Point 6 — Coach SCG non culpabilisant

| | |
|--|--|
| **Statut** | **partiel** |
| **Critère de succès** | Score affiché avec ton coach : « Ton score est 520, bon début. Pour l’améliorer : (1) … (2) … ». Jamais un message isolé « risque élevé ». Option audio. |
| **Comment cocher** | Relire `/scg` avec 3 producteurs : aucun ne se sent « sanctionné » ; chacun cite au moins 1 action. |
| **Preuve** | Capture + verbatim entretien. |
| **Ancrage code** | [`app/scg/page.tsx`](../app/scg/page.tsx), [`components/scg/scg-display.tsx`](../components/scg/scg-display.tsx). |
| **Dépendances** | Règles « 2 actions » dérivées des dimensions v1 (pas besoin SCG v2 FastAPI pour la bêta). |

### Point 7 — Audio accessible (norme stricte)

| | |
|--|--|
| **Statut** | **partiel** |
| **Critère de succès** | Pour chaque contenu audio : contrôle play/stop, résumé 1 phrase, bouton « Voir le texte », pas d’auto-play sans Mode écoute explicite. Libellés WCAG. Langues locales = badge de fierté, pas mode dégradé. |
| **Comment cocher** | Checklist a11y manuelle (lecteur d’écran + utilisateur malentendant simulé) sur feed, shop, digest. |
| **Preuve** | Rapport QA audio (5 écrans). |
| **Ancrage code** | HWL, Digest, Mode écoute, contraste cognitif, `audio_lang` — déjà en prod partielle. |
| **Dépendances** | Désactiver / encadrer auto-listen feed ; bouton transcription. |

### Point 8 — Support « Parler à quelqu’un »

| | |
|--|--|
| **Statut** | **partiel** |
| **Critère de succès** | Depuis n’importe quel écran clé (Moi, erreur paiement, affacturage), un CTA ouvre WhatsApp avec template pré-rempli (type user + problème). Réponse humaine ≤24 h en bêta. |
| **Comment cocher** | Taper le CTA → WhatsApp s’ouvre avec texte prérempli ; numéro = [`lib/contact.ts`](../lib/contact.ts). |
| **Preuve** | Lien wa.me testé + log support. |
| **Ancrage code** | [`app/contact/page.tsx`](../app/contact/page.tsx) ; pas de FAB global. |
| **Dépendances** | Ops : créneau réponse WhatsApp. |

### Point 9 — Offline utile (avantage, pas feature cachée)

| | |
|--|--|
| **Statut** | **manquant** (shell PWA seulement) |
| **Critère de succès** | Sans réseau : consulter offres/stock déjà chargés, écouter audios cachés, **enregistrer** une offre (photo + audio) en brouillon ; à la reconnexion, sync discrète sans popup anxiogène. |
| **Comment cocher** | Mode avion après 1 session online : 3 actions ci-dessus réussies. |
| **Preuve** | Vidéo mode avion. |
| **Ancrage code** | [`public/sw.js`](../public/sw.js) ; WatermelonDB = plan 2027 ([mobile-phase1-2027.md](./mobile-phase1-2027.md)). |
| **Dépendances** | MVP web : cache IndexedDB des brouillons + SW étendu — avant RN. |

### Point 10 — Preuve terrain (1 coop pilote)

| | |
|--|--|
| **Statut** | **manquant** (process) |
| **Critère de succès** | ≥1 coopérative a suivi le **script animateur** (section 6) ; ≥3 producteurs ont publié ; ≥1 parcours paiement ou demande d’avance documenté ; feedback « facile / difficile » collecté. |
| **Comment cocher** | Fiche pilote remplie (date, lieu, N users, verbatim, captures). |
| **Preuve** | Dossier `docs/pilotes/` ou Notion + export. |
| **Ancrage** | [beta-test-matrix.md](./beta-test-matrix.md) profils 1–2. |
| **Dépendances** | Partenaire INP-HB / coop ; animateur formé. |

---

## 4. Backlog priorisé (post-checklist — pas encore implémenté)

```text
P0  Simplicité + confiance     → points 1, 2, 3, 4
P1  Pédagogie + support        → points 5, 6, 7, 8
P2  Offline + différenciation  → points 9, 10 + vue banque + Harmattan Radio
```

### P0 — avant tout le reste

1. Accueil ≤3 blocs + audio « Me l’expliquer » (garder le feed en second plan)
2. Nav 3 onglets FR : Marché / Messages / Moi
3. Écran unique Vente (Photo + Audio + Prix + Quantité) + confirmation audio
4. Stepper escrow au checkout + confirmation commande

### P1 — crédibilité inclusive

5. Audio pédagogique avance + copy SCG « coach »
6. Coach SCG : 2 actions concrètes + TTS
7. « Voir le texte » + résumé partout ; auto-play seulement si Mode écoute ON
8. FAB / entrée « Parler à quelqu’un » (WhatsApp template)

### P2 — avantage compétitif & preuve

9. Brouillons offline + sync discrète (MVP web)
10. Pilote coop + script animateur exécuté
11. *(Invention)* Vue Banque/Bailleur lisible (résumé livraisons + SCG 5 dims + « Pourquoi ce score »)
12. *(Invention)* Harmattan Radio (digest matin + rappels avance/paiement)

---

## 5. Indicateurs UX bêta (mesure profonde)

À suivre dès le premier pilote (tableur ou `/admin` léger) :

| Métrique | Cible indicative bêta | Source |
|----------|----------------------|--------|
| % producteurs qui publient sans abandon | ≥ 70 % | Analytics / logs `POST /api/products` |
| Temps médian publication (photo+audio) | ≤ 90 s | Chrono terrain |
| % acheteurs allant au bout du paiement | ≥ 60 % des paniers démarrés | Orders `payment_status` |
| % demandes d’avance complètes (éligibles) | ≥ 80 % | `factoring_requests` |
| Temps médian demande d’avance | ≤ 3 min | Chrono terrain |
| NPS / question « facile ? » (1–5) | ≥ 4 médiane | Entretien 5–10 users |
| Tickets WhatsApp résolus &lt; 24 h | ≥ 80 % | Log support |

Ne pas se contenter de « l’app marche » : chaque parcours héros a un **taux de succès** et un **temps**.

---

## 6. Script animateur coop (outline 5 minutes)

Objectif : une animatrice ouvre GWA avec un groupe ; en 5 minutes tout le monde comprend.

| Min | Action | Écran / audio |
|-----|--------|----------------|
| 0:00 | « GWA sert à vendre, être payé en sécurité, et demander une avance si besoin. » | Accueil 3 blocs (Point 1) |
| 0:45 | Audio « Me l’expliquer » sur Vendre | TTS / onde |
| 1:30 | Démo : publier tomates (photo + voix + prix) | Parcours Vente (Point 3) |
| 2:30 | Montrer « l’argent reste protégé jusqu’à livraison » | Stepper escrow (Point 4) |
| 3:15 | Montrer score SCG + « 2 actions pour monter » | Coach SCG (Point 6) |
| 4:00 | Si SCG ≥ 500 : montrer demande d’avance (sans forcer) | Affacturage (Point 5) |
| 4:30 | « Un problème ? Parler à quelqu’un » → WhatsApp | Point 8 |
| 5:00 | Installer PWA / laisser Mode écoute activé | `/download` |

Livrable terrain associé : fiche 1 page (participants, problèmes rencontrés, 1 verbatim positif, 1 friction).

---

## 7. Signaux de confiance (à rappeler partout où c’est pertinent)

- Paiements via **Feexpay CI** (agrégateur licencié) — escrow jusqu’à confirmation livraison.
- **SCG** = score de confiance expliqué, pas vendu au plus offrant.
- Données : renvoyer vers confidentialité / conditions existantes, langage simple.

---

## 8. Comment utiliser ce document

1. **Revue hebdo** : cocher / décocher les 10 points (statut réel, pas ambition).
2. **Sprint** : ne prendre que des items **P0** tant que 1–4 ne sont pas `fait`.
3. **GO bêta terrain** : Points **1, 3, 4, 8, 10** au minimum `fait` ou `partiel` avec plan de mitigation écrit.
4. **Incubateurs / banques** : joindre ce doc + fiche pilote Point 10 + export CSV factoring.

---

## 9. Inventaire différenciateurs déjà en place (ne pas perdre)

Ces briques existent — la checklist sert à les **ancrer dans des parcours simples**, pas à les reconstruire :

- Harmattan Wave Language (ondes audio)
- Mode écoute + parcours vocal shop
- Harmattan Digest (cron + push + deep-link)
- Voix communautaire (`audio_lang`)
- Rituels Harmattan (streak discret)
- Contraste cognitif (résumé 1 phrase)
- SCG v1 + affacturage semi-manuel
- Escrow Feexpay (API)
- PWA installable

---

*Document livrable A — checklist seule. Aucune implémentation UI dans ce commit.*  
*Prochaine étape si validation : sprint P0 (accueil + nav + vente + escrow UX).*
