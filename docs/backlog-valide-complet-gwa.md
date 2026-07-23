# GWA — Backlog validé (complet)

**Statut :** toutes les suggestions ci-dessous sont **validées produit** (23 juil. 2026).  
**Prod :** https://v0-gwa-mu.vercel.app · **Notion :** https://app.notion.com/p/3a6a6d3a76b481dda9c1db16ead9dcec

> Exécuter par **lots** (go-live d’abord, puis UX par compartiment). Ne pas tout shipper d’un coup.

---

## A. Go-live (bloquants)

- [ ] **FeexPay** — `payment_url` réel + parcours panier→pay→webhook E2E
- [ ] **SMS** — Twilio (ou AT) crédité + OTP téléphone réel CI / SN / BJ
- [ ] **OneSignal** — origines web push (prod + preview) + opt-in clair
- [ ] **Géo catalogue** — ville/pays obligatoires à la publication produit
- [ ] **Wallet** — productiser retraits OU masquer en bêta
- [ ] **E2E critiques** — login OTP, Digest, KYC approve, offre→commande, escrow

---

## B. Shell, navigation, PWA

### Bottom nav / App shell
- [ ] Badge compteur non-lus (messages + notifs) sur onglets
- [ ] Haptic léger au changement d’onglet (si supporté)
- [ ] État « hors-ligne » discret dans le shell
- [ ] Masquer `/dev/routes` hors environnement de développement

### PWA / Download
- [ ] Raccourci écran d’accueil « Écouter Digest »
- [ ] Bannière install PWA contextuelle (après 2e visite utile)
- [ ] Page `/download` : QR + étapes Android/iOS en français simple
- [ ] Catalogue hors-ligne (derniers produits vus)
- [ ] Prefetch intelligent feed → boutique au scroll

### Accessibilité / i18n
- [ ] Contraste AA sur CTA primaires (shop rouge / feed)
- [ ] Tailles texte « Grand » dans Paramètres
- [ ] Préparation FR / Nouchi léger (glossaire UI)

---

## C. Auth & onboarding

### Login / Signup / OTP
- [ ] Illustration pays → indicatif auto (CI, SN, BJ, ML, BF…)
- [ ] Compteur renvoi OTP + « SMS non reçu ? » (WhatsApp / appel)
- [ ] Écran « code envoyé » avec animation micro-confiance
- [ ] Forgot / reset password : copy 100 % humaine, zéro jargon

### Onboarding
- [ ] Parcours 3 écrans : Qui es-tu ? / Où vends-tu ? / Active les notifs
- [ ] Choix rôle acheteur / producteur / les deux (sans jargon)
- [ ] Skip + reprise depuis Profil

### Liaison email / téléphone (`/profil/lier`)
- [ ] Timeline visuelle cooldown 90 j
- [ ] Rappel J-7 avant fin de cooldown

---

## D. Feed (`/`)

- [ ] Fil **Suivis** vs **Pour vous**
- [ ] Stories 24h producteurs proches (photo + micro)
- [ ] Réaction 👍 rapide (double-tap déjà OK → réaction persistée)
- [ ] Signaler un post / commentaire (raison + mute auteur)
- [ ] Composer publication : brouillon auto-sauvegardé
- [ ] Filtres « près de moi » / « vérifiés seulement »
- [ ] Skeleton shimmer cohérent (pas de flash blanc)
- [ ] Empty state : « Suivre 3 producteurs » CTA

### Commentaires (posts & produits)
- [ ] Modifier / supprimer mon commentaire
- [ ] Mentions `@`
- [ ] Tri Plus récents / Plus aimés
- [ ] Réponses imbriquées max 2 niveaux (déjà parent) + collapse
- [ ] Notif « a répondu à votre commentaire »

### Publier (`/publier`) & post détail
- [ ] Preview avant envoi (image + texte + audio)
- [ ] Limite claire taille média + compression auto
- [ ] `/post/[id]` partage deep-link WhatsApp prêt

---

## E. Boutique / Digest / Parcours (`/marketplace`)

- [ ] Badge « N nouveautés » sur onglet Boutique
- [ ] Vitesse Lent / Normal / Rapide (Parcours + Digest)
- [ ] Pause / Reprendre / Passer produit (contrôles visibles)
- [ ] Digest « ce matin près de chez vous » (titre localisé)
- [ ] Filtre catégorie + prix + distance (1 écran)
- [ ] Mode grille / liste mémorisé
- [ ] Highlight produit en cours pendant le tour (déjà partiel → renforcer)

### Recherche (`/recherche`)
- [ ] Suggestions voix (« cherche cacao Abidjan »)
- [ ] Historique recherches + clear
- [ ] Résultats mixtes produits + posts + producteurs

### Favoris (`/favoris`)
- [ ] Collections (« À acheter », « Pour le champ »)
- [ ] Alerte baisse de prix

---

## F. Produit & panier

### Fiche produit (`/produit/[id]`)
- [ ] Avis / notes riches (comme commentaires feed)
- [ ] « Demander le prix » vocal → message chat prérempli
- [ ] Galerie swipe + zoom
- [ ] Badge stock / « plus que X »
- [ ] Upsell « aussi près de chez vous »
- [ ] Édition vendeur (`/produit/[id]/edit`) : checklist qualité photo

### Panier (`/panier`)
- [ ] Récap escrow en 1 phrase avant payer
- [ ] Quantités +/- accessibles au pouce
- [ ] Sauvegarder panier entre sessions
- [ ] Coupon / code promo (fondation)

---

## G. Chat & messages (`/messages`)

- [ ] Réactions emoji sur message
- [ ] Indicateur « en train d’écrire »
- [ ] Accusé lu (double check style WhatsApp)
- [ ] Épingler conversation / archiver
- [ ] Recherche dans une conversation
- [ ] Template « Offre rapide » (prix + quantité + délai)
- [ ] Transfert offre→commande encore plus visible (bandeau sticky)
- [ ] Mute conversation 8 h / 24 h

---

## H. Commandes, escrow, factures

### Dashboard commandes (`/dashboard/commandes`, confirmation)
- [ ] Timeline visuelle : Payé → Expédié → Reçu → Fonds libérés
- [ ] Rappel J-1 avant libération fonds
- [ ] Photo de réception acheteur
- [ ] Bouton litige avec motifs guidés (pas texte libre seul)
- [ ] Statuts en langage marché (« Argent bloqué chez GWA »)

### Facture (`/facture/[id]`)
- [ ] PDF téléchargeable + partage WhatsApp
- [ ] Mentions légales CI / NIF si dispo

### Paiement FeexPay
- [ ] Écran attente paiement + polling statut
- [ ] Retry / changer moyen de paiement
- [ ] Reçu push + in-app

---

## I. Wallet (`/wallet`)

- [ ] Solde réel vs « en escrow »
- [ ] Historique mouvements (crédits / retraits / frais)
- [ ] Retrait Mobile Money (Orange / MTN / Moov) — ou masquer
- [ ] Seuil minimum + frais affichés avant confirm
- [ ] Freeze wallet si litige ouvert

---

## J. Profil, KYC, SCG

### Profil (`/profil`, `/profil/[id]`, edit)
- [ ] Badge vérifié visible sur carte feed + chat
- [ ] Onglets Produits / Posts / Avis plus clairs
- [ ] Couverture + avatar crop guidé
- [ ] « Partager mon profil » QR / lien
- [ ] Stats : ventes, note, délais (langage simple)

### KYC (`/profil/verification`, BO Vérification)
- [ ] Timeline Envoyé → En revue → Validé / Refusé
- [ ] Relance auto si selfie / pièce flous
- [ ] Exemples photo « bons / mauvais »
- [ ] SLA 24 h visible côté user + admin

### SCG (`/scg`, admin SCG)
- [ ] Explication en langage simple (« pourquoi mon score »)
- [ ] Conseils actionnables (« confirmer 3 commandes »)
- [ ] Historique variations score

---

## K. Lieux, GPS, météo, agriculture

### Mes lieux (profil)
- [ ] Types : champ / entrepôt / marché / domicile
- [ ] Rayon Digest par lieu (ex. 15 km)
- [ ] Partage position ponctuel dans chat (déjà partiel)

### Météo / Agriculture (`/agriculture`, widget)
- [ ] Alerte pluie / sécheresse locale (push opt-in)
- [ ] Conseils culture liés à la catégorie vendue
- [ ] Lien météo → « produits à mettre en avant demain »

---

## L. Coopératives

### Liste / détail / rejoindre / create
- [ ] Vitrine publique enrichie (cover, mission, contacts)
- [ ] Digest coop dédié (nouveautés membres)
- [ ] Membres + volumes du mois
- [ ] Rôles coop (président / trésorier / membre)
- [ ] Invite WhatsApp `?coop=`
- [ ] Dashboard coop (`/dashboard/cooperative`) : stocks collectifs
- [ ] Create : wizard 4 étapes + validation admin optionnelle

---

## M. Affacturage (`/affacturage`, admin)

- [ ] Simulateur « combien je peux obtenir »
- [ ] Statuts clairs + pièces jointes
- [ ] Notif à chaque étape (soumis / validé / décaissé)
- [ ] Admin : checklist risque + export

---

## N. Dashboards vendeur / acheteur

### `/dashboard`, farmer, buyer, products
- [ ] Home dashboard : 3 KPI + 3 actions (pas de wall)
- [ ] Nouveau produit : photo → prix → lieu (obligatoire)
- [ ] Stock bas alerte
- [ ] Avis reçus (`/dashboard/reviews`) : répondre
- [ ] Mode « fermé aujourd’hui » (pause ventes)

---

## O. Notifications (`/notifications`)

- [ ] Quiet hours (ex. 22h–6h)
- [ ] Préférences par canal (push / in-app / WhatsApp)
- [ ] Groupement Digest + commandes
- [ ] Marquer tout lu + filtres (commandes / social / système)
- [ ] Deep-link toujours vers la bonne page (déjà partiel → audit)

---

## P. Support & légal

### Contact (`/contact`) + Admin Support
- [ ] Réponse email 1 clic depuis BO
- [ ] Catégories ticket (bug / paiement / KYC / autre)
- [ ] SLA premier réponse < 24 h (badge)
- [ ] Pièce jointe screenshot côté user

### Légal (`/conditions`, `/confidentialite`)
- [ ] Sommaire cliquable
- [ ] Version + date de mise à jour visible
- [ ] Consentement cookies / push explicite

---

## Q. Back-office (toutes sections)

| Section | Suggestions validées |
|---------|----------------------|
| **Dashboard** | [ ] Alertes du jour (KYC en retard, litiges, support ouverts) |
| **Utilisateurs** | [ ] Freeze / unfreeze + motif ; recherche téléphone |
| **Produits** | [ ] Modération photo floue ; force géo |
| **Commandes** | [ ] Actions escrow groupées ; filtre statut |
| **Coopératives** | [ ] Approuver / suspendre ; stats membres |
| **Signalements** | [ ] File priorisée + mute auto |
| **Support** | [ ] Reply email 1 clic ; macros réponses |
| **Litiges** | [ ] Timeline + preuves côte à côte |
| **Vérification** | [ ] SLA 24 h ; zoom docs ; reject motifs |
| **SCG** | [ ] Recalc batch ; outliers |
| **Finances** | [ ] Reconcil FeexPay ; export CSV |
| **Affacturage** | [ ] Checklist risque ; décaissement |
| **Statistiques** | [ ] Funnel OTP→1ère commande ; Digest opens |
| **Paramètres** | [ ] Feature flags ; maintenance banner |
| **Digest (nouveau)** | [ ] Runs cron, ouvertures, 0-nouveauté days |

### Cross-admin
- [ ] Export CSV commandes / litiges / support
- [ ] Journal audit lisible (qui a fait quoi)
- [ ] Mode « support only » UI allégée

---

## R. Confiance, sécurité, ops

- [ ] Badge vérifié sur carte feed + fiche produit
- [ ] Alerte prix anormalement bas (modération)
- [ ] Journal privacy « qui a vu mon numéro »
- [ ] Rate-limit messages chat (anti-spam)
- [ ] Health board interne (secrets, cron last run, SMS provider)
- [ ] Retirer / protéger endpoints migrations admin après apply
- [ ] E2E Playwright CI (smoke nightly)

---

## S. Contenu & marque

- [ ] Empty states illustrés Harmattan (pas de page blanche)
- [ ] Microcopy 100 % marché (éviter anglicismes techniques)
- [ ] Toast succès courts (« C’est noté »)
- [ ] Erreurs réseau : retry 1 bouton, jamais stack trace

---

## Ordre d’exécution recommandé

1. **Lot Go-live** (section A)  
2. **Lot Confiance** (KYC timeline, badge vérifié, escrow timeline)  
3. **Lot Engagement** (Feed Suivis, commentaires edit, chat typing)  
4. **Lot Digest** (vitesse, badge nouveautés, géo publish, dashboard Digest)  
5. **Lot BO** (Support reply, SLA, exports)  
6. **Lot PWA / Perf** (raccourci Digest, offline, prefetch)

---

*KOUAME CORPORATION — GWA · Backlog validé · 23 juil. 2026*
