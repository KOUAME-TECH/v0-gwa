# État des lieux GWA — 21 juil. 2026

**Branche :** `main` @ `9fbe83e`  
**Prod :** https://v0-gwa-mu.vercel.app — `/api/health` → **healthy**, DB **connected**  
**Cible bêta :** 1er septembre 2026 (scope F1–F6)  
**Tests :** 82 Vitest OK  

---

## 1. Surfaces

| Surface | État |
|---------|------|
| GitHub `main` | À jour avec origin |
| Prod PWA | `v0-gwa-mu.vercel.app` |
| Supabase | Projet `frorfexbcyfbydkiwxqv` |
| Migrations vocales | **039** applied · **040** applied (vérifié API admin) |
| Cache SW | `gwa-v10-harmattan-digest` |
| PR UX démo/checklist | Branche `cursor/ux-beta-checklist-f056` **supprimée** (non retenue) |

---

## 2. Verdict GO / NO-GO

| | |
|--|--|
| **Code F1–F6** | Largement en place |
| **Lancement prod réel** | **NO-GO** tant que les bloqueurs humains ci-dessous ne sont pas levés |

### Bloqueurs humains (hors code)

1. **Africa’s Talking SMS** — OTP live (401)  
2. **Feexpay** — compte marchand + URL checkout live  
3. **OneSignal** — envoi push non validé en prod  
4. **Seed 1er admin** — si pas encore fait  
5. **`CRON_SECRET`** — pour activer Harmattan Digest quotidien  
6. Toggle **HIBP** Supabase Dashboard (optionnel mais recommandé)

---

## 3. Par domaine

Légende : **OK** · **PARTIEL** · **MANQUANT** · **BLOQUÉ**

### Auth & profils (F3)

| Élément | Statut | Notes |
|---------|--------|-------|
| Login email / password | OK | `/auth/login` |
| OTP SMS (code) | OK | APIs send/verify |
| OTP SMS live | BLOQUÉ | AT 401 |
| Onboarding producteur / coop | OK | `/auth/onboarding` |
| Édition profil + ville/pays | OK | `/profil/edit` |
| Lien email ↔ téléphone | OK | `/api/auth/link-email` |

### Catalogue & marketplace (F1)

| Élément | Statut | Notes |
|---------|--------|-------|
| Catalogue + fiche produit | OK | `/marketplace`, `/produit/[id]` |
| Publier offre | OK | `/publier` (+ dashboard products) |
| Audio produit / TTS | OK | Ondes Harmattan Wave |
| Parcours vocal shop | OK | Bouton « Parcours » |
| Mode écoute | OK | Toggle header |

### Feed & social

| Élément | Statut | Notes |
|---------|--------|-------|
| Feed posts + produits | OK | `/` |
| Commentaires texte + voix | OK | `/api/comments` + mig 039 |
| Suivre / ne plus suivre | OK | Dynamique + login |
| Réseau / communauté | MANQUANT | Hors scope — pages retirées |
| Page `/post/[id]` | MANQUANT | Feed inline seulement |

### Commandes & escrow (F2)

| Élément | Statut | Notes |
|---------|--------|-------|
| Panier → commande | OK | `/panier`, `POST /api/orders` |
| APIs pay / confirm / litige | OK | Code prêt |
| Checkout Feexpay live | BLOQUÉ | Merchant account |
| Stepper escrow visible UI | PARTIEL | Backend oui ; UX peu explicite |
| Confirm/litige branchés UI dashboard | PARTIEL | APIs prêtes, UI incomplète |
| Facture numérique | OK | `/facture/[id]` |

### Affacturage & SCG (F6)

| Élément | Statut | Notes |
|---------|--------|-------|
| Demande avance + file admin | OK | `/affacturage`, `/admin/factoring` |
| Éligibilité SCG ≥ 500 | OK | `lib/factoring/eligibility.ts` |
| SCG v1 (gauge, 5 dims) | OK | `/scg` |
| Coach SCG pédagogique | PARTIEL | Score oui ; ton « coach » limité |
| SCG v2 5C FastAPI | MANQUANT | Post-bêta |
| Vue banque /partner | MANQUANT | Post-bêta (CSV NDA seulement) |

### Messages & notifications (F4)

| Élément | Statut | Notes |
|---------|--------|-------|
| Chat 1:1 + vocaux | OK | `/messages` |
| Notifs in-app | OK | `/notifications` |
| Push OneSignal | PARTIEL | Code + register ; prod non testé |
| Appels audio/vidéo | MANQUANT | « Bientôt » |

### Admin (F5)

| Élément | Statut | Notes |
|---------|--------|-------|
| Gate `admin_roles` | OK | |
| Users, products, KYC, factoring, SCG, export | OK | |
| Orders / disputes / analytics | PARTIEL | Profondeur variable |

### Audio Harmattan (livré 20–21 juil.)

| Élément | Statut | Notes |
|---------|--------|-------|
| Symbole onde (HWL) | OK | Vert = enregistré · ambre = TTS |
| Puce « Note vocale » | OK | Plus de « appuyez pour… » |
| Mode écoute | OK | localStorage |
| Parcours vocal marketplace | OK | |
| Harmattan Digest (cron + push + deep-link) | OK | Code ; cron needs `CRON_SECRET` |
| Voix communautaire `audio_lang` | OK | fr / wo / bm / … |
| Écoute contextuelle feed | OK | Mode écoute + scroll |
| Rituels Harmattan (streak 7j) | OK | Badge discret |
| Contraste cognitif (résumé 1 phrase) | OK | |
| Offline utile (brouillons sync) | MANQUANT | PWA shell seulement |

### PWA

| Élément | Statut | Notes |
|---------|--------|-------|
| Manifest + icônes Harmattan | OK | 192 / 512 |
| Install `/download` | OK | |
| SW cache shell | OK | `gwa-v10-…` |
| Offline catalogue / commandes | MANQUANT | Plan 2027 RN |

---

## 4. Architecture (rappel)

```
Next.js App Router (web + admin)
    ↓
Supabase Auth + Postgres + RLS + Storage
    ↓
Feexpay (escrow) · OneSignal (push) · Africa’s Talking (SMS)
```

- **SCG** : moteur v1 TypeScript (`lib/scg/engine.ts`)  
- **Paiement** : escrow API ; checkout live bloqué ops  
- **Agents** : QA / Security / Scope / Health — `docs/agents-fleet.md`

---

## 5. Scope bêta (ce qui est volontairement hors)

Formations, e-learning, artisanat, B2B RFQ, réseau social type LinkedIn, wallet BCEAO, appels WebRTC, dashboard banque UI, SCG v2 FastAPI.

---

## 6. Ce qui a été fait récemment (20–21 juil.)

1. Commentaires vocaux + migration **039** en prod  
2. Audio produits (feed + fiche + shop)  
3. UI onde Harmattan Wave (minimaliste)  
4. Mode écoute + parcours vocal marketplace  
5. Digest + langues + rituels + auto-écoute + résumé cognitif (mig **040**)  
6. Tentative checklist UX + démo HTML → **rejetée / branche supprimée**

---

## 7. Priorités suggérées (prochaines)

| Priorité | Action | Type |
|----------|--------|------|
| P0 | Débloquer Feexpay live + brancher UI confirm/litige | Ops + code |
| P0 | Débloquer OTP SMS AT | Ops |
| P1 | Stepper escrow lisible au checkout | Code UX |
| P1 | Tester push OneSignal + `CRON_SECRET` Digest | Ops |
| P2 | Coach SCG (2 actions + audio) | Code |
| P2 | FAB « Parler à quelqu’un » WhatsApp | Code |
| Post-bêta | Offline utile · vue banque · SCG v2 | Roadmap |

---

## 8. Références

- [scope-beta.md](./scope-beta.md) — périmètre F1–F6  
- [ops-go-live.md](./ops-go-live.md) — checklist GO/NO-GO  
- [beta-test-matrix.md](./beta-test-matrix.md) — 7 profils test  
- [ops-auth.md](./ops-auth.md) — OTP SMS  
- [architecture.md](./architecture.md)

---

*Document vivant — à mettre à jour à chaque jalon GO ou merge majeur sur `main`.*
