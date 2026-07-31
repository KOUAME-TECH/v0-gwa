# Propositions d’amélioration & optimisation GWA

**Date :** 31 juillet 2026  
**Contexte :** PWA healthy ; FeexPay / SMS Sender ID encore absents en prod ; traction faible.

---

## A. Impact immédiat (faire d’abord)

| # | Proposition | Pourquoi | Effort |
|---|-------------|---------|--------|
| **A1** | Remettre `FEEXPAY_*` + webhook sur Vercel + E2E sandbox | Sans ça, zéro encaissement / promesse escrow creuse | Ops 1 j |
| **A2** | `AT_SENDER_ID` → `sms_delivery_ready: true` | OTP fiable = onboarding terrain | Ops 1 h |
| **A3** | Activer HIBP (Leaked Password Protection) | Dernier WARN Security Advisor | Dashboard 5 min |
| **A4** | Soft launch invite-only (1 coop / SIDONOBIEL) | Preuve réelle > features | Produit |

---

## B. Produit / monétisation

| # | Proposition | Gain |
|---|-------------|------|
| **B1** | Paiement abo Starter/Pro via FeexPay (fin WhatsApp-only) | Conversion + moins d’ops manuel |
| **B2** | UX checkout « même réseau MM » (pay-in = payout) | Moins de frais FeexPay perçus |
| **B3** | Parcours litige simple (freeze payout + status `frozen`) | Confiance acheteur |
| **B4** | Seed démo : 1 coop + 15–20 produits + 1 commande guidée | Pitch / formation équipe |
| **B5** | Badge + filtre « vendeurs Pro » dans marketplace | Valorise l’abo déjà codé |

---

## C. Technique / perf / offline

| # | Proposition | Gain |
|---|-------------|------|
| **C1** | Outbox médias (photo publish offline) | Offline utile terrain |
| **C2** | Prefetch PDP + images lazy plus agressif (data-saver) | 3G / zones faibles |
| **C3** | Cache API catalogue (CDN / stale-while-revalidate) | Marketplace plus snappy |
| **C4** | Job monitoring paiements (webhook raté → alerte admin) | Moins de commandes bloquées |
| **C5** | Ne pas DROP index core (Advisor « unused » = bruit bêta) | Évite régressions plus tard |
| **C6** | Tests E2E Playwright : pay → confirm → wallet | Filet go-live |

---

## D. Confiance / partenaires

| # | Proposition | Gain |
|---|-------------|------|
| **D1** | CGV 1 page « escrow applicatif / compte marchand » | Discours BP honnête |
| **D2** | Décision écrite CinetPay (POC dual ou report) | Filet séquestre |
| **D3** | Export dossier SCG (PDF/CSV) pour IMF | Prépare MoU banque |
| **D4** | Affacturage : statut + SLA réponse admin visible vendeur | Rétention Pro |

---

## E. Growth / ops équipe

| # | Proposition | Gain |
|---|-------------|------|
| **E1** | Dashboard admin GMV / commissions réelles / escrow held | Pilotage |
| **E2** | Funnel OTP → 1ʳᵉ annonce → 1ʳᵉ vente (métriques simples) | Savoir où ça casse |
| **E3** | Templates WhatsApp support (abo, litige, KYC) | Scaler sans chaos |
| **E4** | Checklist onboarding coop (15 membres / 14 j) dans l’app | Moins de drop validation |

---

## F. Ce qu’il ne faut PAS faire maintenant

- Multi-pays / API Enterprise / SCG v2 FastAPI  
- DROP massif d’index « unused » sur products/orders  
- Exclusivité FeexPay 12 mois  
- Nouveaux modules hors agri (formations, social, artisanat)  
- Promesse « séquestre bancaire » tant que E2E FeexPay n’est pas vert  

---

## G. Ordre recommandé (2 sprints)

**Sprint 1 — Go-live crédible**  
A1 → A2 → A3 → E2E sandbox → A4  

**Sprint 2 — Monétiser + terrain**  
B1 → B4 → B2 → C1 → E1 → D1  

---

*Aligné CdC `docs/cahier-des-charges-actuel-evolution-6-12-24.md` et health prod du 31/07.*
