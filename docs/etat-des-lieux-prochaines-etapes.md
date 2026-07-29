# État des lieux GWA + prochaines étapes

**Date :** 29 juillet 2026  
**Prod :** https://v0-gwa-mu.vercel.app · branche `main` (`97e89ab`)  
**Health :** `healthy` · DB `connected`

---

## 1. Verdict en une phrase

**Produit PWA prêt à démontrer** (catalogue, abo, offline, Yelly, escrow codé) — **go-live monétisé encore bloqué ops** (FeexPay keys absentes en health, SMS Sender ID manquant, traction faible).

---

## 2. Ce qui est livré (fait)

| Domaine | État |
|---------|------|
| Marketplace / feed / publier / panier | OK |
| Pricing vendeur Free / 7 500 / 18 000 + commissions 8 / 6,5 / 5 % | OK + entitlements code |
| Type de compte verrouillé | OK |
| Coops : validation progressive + multi-gestion | OK |
| Escrow applicatif (pay → hold → confirm → payout) | **Codé** |
| Wallet retraits (plus de faux succès) | OK |
| Offline PWA (`gwa-v21-offline`) | OK (texte ; médias limités) |
| Yelly / Gemini | OK (`GEMINI_API_KEY` true) |
| OneSignal / digest | Configurée |
| Docs équipe (onboarding + CdC + ops) | Nettoyé (~18 fichiers) |
| Tests Vitest | ~177 verts |

---

## 3. Snapshot prod (29/07)

| Check | Valeur | Lecture |
|-------|--------|---------|
| App / DB | healthy / connected | OK |
| Gemini | true | OK |
| OneSignal | true | OK |
| SMS AT + username live | true | OK |
| **SMS Sender ID** | **false** | `sms_delivery_ready: false` |
| **FEEXPAY_API_KEY / SHOP_ID** | **false** | pay-in / payout **non configurés** en prod |
| FeexPay mode | sandbox (défaut) | Pas live |

### Données

| Entité | Volume |
|--------|--------|
| Profils | ~12 |
| Produits actifs | ~3 |
| Coopératives | 0 |
| Commandes | ~2 |
| Demandes abo | 3 |

---

## 4. Écarts vs promesse BP

| Promesse | Code | Prod ops |
|----------|------|----------|
| Escrow pay-in / payout | Branché | **Keys FeexPay absentes** → pas d’encaissement réel |
| OTP fiable | Branché | Sender ID manquant (health rouge) |
| Abo = services | Aligné | Activation encore WhatsApp + admin |
| Coops actives | Policy OK | **0 coop** en base |
| Traction marketplace | UI OK | Quasi nulle |

---

## 5. Prochaines étapes (ordre)

### P0 — cette semaine (bloquants)

1. **Vercel :** remettre `FEEXPAY_API_KEY` + `FEEXPAY_SHOP_ID` (+ `FEEXPAY_WEBHOOK_SECRET`, `FEEXPAY_MODE=sandbox`) → redeploy → health `feexpay.configured: true`.
2. **Vercel :** `AT_SENDER_ID` (Sender ID approuvé CI) → redeploy → `sms_delivery_ready: true`.
3. **E2E sandbox :** 1 commande → pay-in → webhook paid/held → confirm → payout → released.
4. **Sécurité :** confirmer rotation clé Gemini si fuite passée ; pas de secret dans le repo.
5. **Soft launch :** invite-only (SIDONOBIEL) — ne pas pitcher escrow bank-grade tant que E2E pas vert.

### P1 — 2 à 4 semaines

6. Paiement abo Starter/Pro via FeexPay (fin WhatsApp-only) + activation auto.
7. Seed démo : 1 coop + catalogue + parcours vendeur/acheteur documenté.
8. Outbox médias (photo publish offline).
9. Runbook litige / freeze payout + CGV escrow applicatif (1 page).
10. Décision écrite CinetPay : POC dual **ou** report daté.

### P2 — horizon 6 mois (CdC)

11. FeexPay **live** + monitoring paiements.
12. 1–2 coops pilotes, conversion abo mesurée.
13. UX « même réseau MM ».
14. KPI : GMV, % abo, litiges, NPS vendeur.

---

## 6. Qui fait quoi

| Étape | Responsable typique |
|-------|---------------------|
| Vars Vercel FeexPay / SMS | Ops / lead tech |
| Test E2E sandbox | Backend + ops |
| Soft launch terrain | Produit / DG |
| CGV / notice fonds | Juridique + produit |
| Seed coop / catalogue | Produit + fullstack |

---

## 7. Docs utiles

- Orientation : `docs/onboarding-equipe.md`
- CdC + roadmap 6/12/24 : `docs/cahier-des-charges-actuel-evolution-6-12-24.md`
- GO/NO-GO : `docs/ops-go-live.md`
- OTP : `docs/ops-auth.md`
- Pricing : `docs/decision-strategique-pricing-gwa-2026-07-28.md`

---

*Màj à chaque jalon P0 (health FeexPay / SMS / E2E).*
