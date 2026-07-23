# GWA — État des lieux & Audit complet
**Date :** 23 juillet 2026 · **Prod :** https://v0-gwa-mu.vercel.app · **PR active :** [#9](https://github.com/MYSTERE-arch/v0-gwa/pull/9) (`cursor/fix-broken-links-f056`)

---

## 1. Synthèse exécutive

GWA (Green West Africa) est une plateforme marketplace agro-africaine mobile-first : catalogue, feed social, chat temps réel, escrow, KYC soft, Score de Confiance (SCG), Digests audio (« Harmattan »), PWA et back-office RBAC.

**Verdict :** plateforme **bêta avancée (F1–F6)** largement câblée et utilisable. Les blocages go-live restants sont surtout **opérationnels / partenaires** (FeexPay live, SMS Twilio stable, OneSignal origines web, migrations 042–046 sur tous les environnements).

| Indicateur | Valeur |
|------------|--------|
| Pages app | ~61 |
| Routes API | ~56 |
| Migrations SQL | 001 → 046 (fichiers présents) |
| Tests Vitest | 25 fichiers · ~117 tests |
| Commits sur PR #9 | 32+ depuis le correctif liens |

---

## 2. Ce qui a été livré (cette vague — juil. 2026)

### 2.1 Stabilité production
- Liens légaux `/conditions`, `/confidentialite` (+ redirects `/legal/*`, `/feed`)
- Coopératives : schéma réel, page détail, slug auto, join `?coop=`
- Health : exposition booléenne secrets (OTP, CRON, SMS)
- Rate-limit : pages GET hors compteur (plus de 429 RSC)
- Shell mobile plein écran, bottom nav 5 onglets, PWA SW

### 2.2 Auth & confiance
- OTP Twilio / Africa’s Talking / Termii + fallbacks clairs
- Messages humains (plus de jargon Vercel / migrations côté user)
- KYC soft (pièce + selfie) + notifs GWA (dépôt / approuvé / refusé) + push
- Badge `is_verified` aligné sur KYC `user`
- Liaison email ↔ téléphone avec cooldown
- Section BO **Vérification d’identité** (`/admin/verifications`)

### 2.3 Audio — Digest & Parcours
- Cause racine du « saute les produits » : `speechSynthesis.cancel()` au remount des micros → verrou tour + cartes stables + retry
- Voix plus naturelle (phrases fluides, voix Google/Microsoft, rate ~0,94)
- Digest feed (CTA header) → boutique `?digest=1`
- **Notifs Digest uniquement s’il y a du nouveau (24h/7j)** — preuve run : `notifications_inserted: 0` sans nouveauté
- Matching géo élargi + type notif `digest` autorisé en SQL
- pg_cron quotidien `gwa-harmattan-digest-daily`

### 2.4 Feed & engagement
- Partager visible (effet réseau)
- Double-tap like, swipe images, pull-to-refresh
- Filtrage posts marketing bas qualité
- **Like + répondre** aux commentaires (posts **et** produits)
- Compteur commentaires resynchronisé (bug « Commentaires (3) » alors que 2 en base) + triggers SQL

### 2.5 Localisation & lieux
- GPS haute précision, reverse geocode
- **Mes lieux** + carte (espace privé)
- Carte à la confirmation de commande

### 2.6 Chat & commandes
- Chat type WhatsApp + caméra `getUserMedia`
- Offre de prix → commande (`/api/orders/from-offer`) alignée escrow / audit / notif

### 2.7 Support
- Formulaire Aide & Contact → table `contact_messages` + email AgentMail
- Inbox BO `/admin/support` (ouverts / en cours / résolus / spam) + badge compteur

### 2.8 Schéma appliqué (prod Supabase)
- `043` contact_messages · `044` digest matching · `045` comment_likes + type verification · `046` sync counts + novelty-only digest + review_likes

---

## 3. Audit par compartiment

### Légende maturité
- **Complet** — utilisable en bêta
- **Partiel** — flux principal OK, trous connus
- **Ops** — code prêt, dépend config partenaire / env
- **Post-bêta** — fondation ou hors scope actuel

| Compartiment | Maturité | Points forts | Risques / trous |
|--------------|----------|--------------|-----------------|
| **Feed** | Complet | Posts, likes, commentaires texte/voix, share, qualité | Pas de stories ; pas de fil « Suivis » |
| **Boutique / Digest** | Complet | Catalogue, Parcours, Digest, audio | Feuille géo produits souvent vide → Digest local faible |
| **Produit / panier** | Partiel | Fiche, panier, TTS | Avis UI produit encore légère vs feed |
| **Chat** | Complet | Realtime, médias, offres→commande | Réactions emoji / typing indicator à enrichir |
| **Auth / OTP** | Ops | Multi-provider, messages clairs | SMS live = Twilio/AT crédits ; HIBP souvent OFF |
| **KYC** | Complet | Soft KYC + notifs + BO | SLA / relance photo floue à productiser |
| **Commandes / Escrow** | Partiel | Confirm, litige, admin release/refund | **FeexPay checkout live incomplet** (`payment_url: null`) |
| **Wallet** | Partiel | Solde dérivé commandes | Retraits / historique encore mock |
| **SCG** | Complet v1 | Calcul + pages user/admin | v2 FastAPI / partenaires hors scope |
| **Affacturage** | Complet semi-manuel | Demande + file admin | Disburse réservé super_admin |
| **Coopératives** | Partiel→Complet | Liste, détail, join | Create / dashboard coop encore fragiles |
| **Lieux / GPS** | Complet | Places, carte, save profil | Dépend migration 042 |
| **Notifs / Push** | Ops | In-app + OneSignal + Digest | Origines web OneSignal ; quiet hours absents |
| **PWA** | Complet | Manifest, SW, install | Raccourci Digest / offline catalogue à venir |
| **Support** | Complet | Inbox + email | Réponse email 1 clic à ajouter |
| **Back-office** | Complet | RBAC 4 rôles, 14 sections | Finances / settings partiels |
| **Sécurité** | Bon | RLS admin, PII, rate-limit, freeze phone | Middleware `/admin` = session only (garde API) |
| **Tests** | Correct | 117 unit tests lib | Pas d’E2E Playwright en CI |

---

## 4. Stack technique

| Couche | Choix |
|--------|--------|
| App | Next.js 16 · React 19 · Tailwind 4 · Radix |
| Backend data | Supabase (Auth, Postgres, Storage, Realtime) |
| Hosting | Vercel |
| Paiement | FeexPay (webhook HMAC) — live à finaliser |
| Email | AgentMail |
| SMS | Twilio → Africa’s Talking → Termii |
| Push | OneSignal Web SDK |
| Météo / géo | Open-Meteo · Nominatim |
| Rate-limit / OTP | Upstash Redis |

---

## 5. Back-office — carte d’accès

**Rôles :** `super_admin` · `admin` · `moderator` · `support`

Sections : Dashboard, Utilisateurs, Produits, Commandes, Coopératives, Signalements, **Support**, Litiges, **Vérification**, SCG, Finances, Affacturage, Statistiques, Paramètres.

---

## 6. Priorités go-live (ordre recommandé)

1. **FeexPay** — finaliser SDK marchand / `payment_url` réel  
2. **SMS** — Twilio (ou AT) crédité + test téléphone réel  
3. **OneSignal** — origines web push (prod + preview)  
4. **Données catalogue** — forcer ville/pays à la publication (Digest local)  
5. **Wallet** — productiser retraits ou masquer en bêta  
6. **E2E critiques** — login OTP, panier→pay, Digest, KYC approve  

---

## 7. Backlog validé — tous compartiments

> **Statut : VALIDÉ produit** (23 juil. 2026).  
> Document exhaustif (pages, BO, auth, wallet, PWA, ops…) :  
> **[backlog-valide-complet-gwa.md](./backlog-valide-complet-gwa.md)** (~150 items, sections A→S).

### Couverture
Shell/PWA · Auth/Onboarding · Feed/Commentaires · Boutique/Digest · Recherche/Favoris · Produit/Panier · Chat · Commandes/Escrow/Factures · Wallet · Profil/KYC/SCG · Lieux/Météo/Agriculture · Coopératives · Affacturage · Dashboards · Notifications · Support/Légal · Back-office (14 sections) · Confiance/Sécurité/Ops · Marque/Copy

### Lots d’exécution
1. Go-live (FeexPay, SMS, OneSignal, géo publish)  
2. Confiance (KYC timeline, badge, escrow)  
3. Engagement (Suivis, edit commentaires, typing chat)  
4. Digest (vitesse, badge, dashboard)  
5. Back-office (Support reply, SLA, exports)  
6. PWA / Perf

---

## 8. Conclusion

GWA dispose d’une **base produit solide** pour une bêta terrain Afrique de l’Ouest : audio-first, confiance (KYC/SCG/escrow), engagement (feed/chat/Digest) et pilotage (admin + support).

La prochaine phase : **industrialiser le go-live** puis **exécuter le backlog validé** par lots (voir doc complet).

---

*Document généré pour KOUAME CORPORATION — GWA · 23 juil. 2026*
