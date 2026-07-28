# Propositions d’amélioration GWA — 28 juil. 2026

Objectif : meilleure marketplace agri mobile d’Afrique de l’Ouest — confiance, simplicité, exécution.

---

## Déjà livré (cette vague)

| Décision | Code |
|----------|------|
| Yelly + Gemini | Secret `platform_secrets` + env ; fallback court |
| Commission vendeur 8 / 6,5 / 5 % | `lib/pricing` + `/api/orders` |
| 0 frais GWA acheteur | Panier + commandes |
| FREE max 5 annonces | `POST /api/products` |
| Multi-gestion coop | Rôles admin/manager |
| Lock type de compte | UI + API + trigger |
| UX moins bavarde | Escrow, SCG, profil, coop, Yelly, push |
| **Offline-first** | Outbox publish texte, sync reconnexion, panier snapshot, PDP cache, SW v21 |

---

## Offline (implémenté)

1. **Publish outbox** — produit/post texte hors ligne → IndexedDB → flush auto à `online`  
2. **Reconnect sync** — banner + `startOfflineSyncListener` + refresh feed/boutique  
3. **PDP offline** — fallback `catalog-cache`  
4. **Panier connecté** — snapshot localStorage 48h  
5. **Yelly offline** — réponse locale immédiate sans fetch  
6. **SW `gwa-v21-offline`** — shell + `/publier`

Médias (photos/vidéo/audio) restent **en ligne** pour l’instant (v2 IDB blobs).

---

## Propositions P0 (qualité « meilleure au monde »)

1. **Paiement live FeexPay** — `payment_url` réel + pay-out à confirmation. Sans ça, la promesse escrow BP n’est pas tenue côté argent.
2. **Dupliquer `GEMINI_API_KEY` sur Vercel** — voir `docs/vercel-gemini-env.md` + **rotation** de la clé exposée.
3. **Page Abonnement vendeur** — upgrade Starter 7 500 / Pro 18 000 avec Mobile Money (sinon la grille reste théorique).
4. **Sender ID Africa’s Talking** — `sms_delivery_ready` encore false en health.
5. **Upload docs coop** + gate features avancées selon `evaluateCoopQualification`.
6. **Outbox médias** — Blobs IDB pour publish photos hors ligne.

## Propositions P1 (différence concurrentielle)

6. **Digest audio** plus fiable (langue locale + offline queue).  
7. **SCG bancable** export PDF 1 page pour banques/IMF.  
8. **Invite coop nominative** (SMS) + journal d’habilitations.  
9. **Litige UX** 3 taps max, preuves média.  
10. **Offline-first publish** : brouillon local → sync auto.

## Propositions P2 (échelle)

11. API partenaires banques (deal flow SCG).  
12. Multi-pays (SN, BF) avec devise XOF déjà prête.  
13. SLA Enterprise + account manager.  
14. Observabilité Yelly (taux fallback vs LLM, latence).

---

## Promesse BP vs état

| Promesse | État |
|----------|------|
| Marketplace mobile agri | OK |
| Argent protégé (escrow) | Orchestration OK ; **tuyau FeexPay live KO** |
| Score de confiance | OK v1 |
| Coopératives réelles | Règles OK ; docs upload à faire |
| Revenus (abo + commission) | **Commission codée** ; abo billing à faire |
| Yelly assistante | **Gemini branché via secret DB** (redeploy requis) |

**Verdict :** continuer jusqu’à FeexPay live + page abo + redeploy Yelly = promesse BP crédible pour go-live.
