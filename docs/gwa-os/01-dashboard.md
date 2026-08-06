# ⚡ Dashboard GWA

**Page quotidienne — mise à jour : 2026-08-06**  
Propriétaire session : Yao Kouamé · Build : agents Cursor

---

## 📋 Pulse

GWA (PWA) est **démontrable** : marketplace, rôles, double identité admin/métier, abo vendeur (file admin), escrow **codé** avec garde-fous sécu récents (RBAC API, trigger profils, payout fail → escrow held).  

Le **go-live monétisé** est encore **rouge ops** : FeexPay non E2E en prod + `AT_SENDER_ID` SMS manquant → `sms_delivery_ready: false`.  

OneSignal (push) ≠ Africa’s Talking (SMS OTP) — les deux sont nécessaires.  

**Mobile natif reporté après le 1er septembre 2026** : focus PWA jusque-là.

---

## 🔴 À faire maintenant

| Item | Propriétaire | Durée / blocage |
|------|--------------|-----------------|
| Brancher `FEEXPAY_API_KEY` + `FEEXPAY_SHOP_ID` (+ webhook) sur Vercel → redeploy | **Yao** | ~30 min + E2E |
| Poser `AT_SENDER_ID` approuvé CI (Africa’s Talking) → `sms_delivery_ready` | **Yao** | Bloqué tiers AT si non approuvé |
| E2E sandbox : pay → held → confirm → payout → released | **Yao** (+ agent support) | Après clés FeexPay |
| Confirmer `GWA_INTERNAL_KEY` (ou `CRON_SECRET`) pour CSRF interne | **Yao** | 5 min |

---

## 🟡 À traiter ensuite

| Item | Propriétaire | Note |
|------|--------------|------|
| Durcir bootstrap premier admin (race) | Agent | Code — P0-C audit v2 |
| Shell `/cooperatives*` + catalogue membres | Agent | UX coop |
| `subscription_expires_at` + downgrade Free | Agent | Abo récurrent |
| Abo vendeur via FeexPay (fin WhatsApp-only) | Agent + Yao | Après FeexPay live |
| Seed soft-launch : 1 coop + 15–20 produits | Yao | Traction démo |
| Coller cet OS dans Notion (pages) | Yao | 15 min une fois |

---

## 🗣 À discuter avec Yao (fondateur)

> Section « associé » : aujourd’hui solo DG — à utiliser pour décisions qui demandent un second regard (investisseur, juridique, banque).

| Sujet | Pourquoi maintenant |
|-------|---------------------|
| Soft-launch SIDONOBIEL invite-only vs ouverture marketplace | Traction vs risque promesse escrow |
| CinetPay en filet vs FeexPay exclusif | Dossier paiement / séquestre |
| Timing mobile natif post-1er sept (Capacitor vs natif) | Budget + focus PWA |
| Qui est le « co-pilote » ops (support / activation abo) | Charge manuelle actuelle |

---

## 🎯 Le cap (période actuelle)

1. **Débloquer l’argent réel** : FeexPay E2E + SMS OTP fiable.  
2. **Soft-launch crédible** : seed contenu + 1 parcours commande guidé.  
3. **PWA solide jusqu’au 1er sept** — pas de digression mobile store.

---

## ⚙️ État du build

| Bloc | État | Phrase honnête |
|------|------|----------------|
| Auth OTP SMS | 🔴 | Code OK ; Sender ID manquant → livraison SMS pas fiable |
| Marketplace / feed / publier | ✅ | Démontrable |
| Panier / checkout UX | ✅ | Erreurs FeexPay claires ; pay live dépend clés |
| Escrow applicatif | 🟡 | Codé + held-on-fail ; **pas E2E live** sans FeexPay |
| Abo vendeur | 🟡 | File admin OK ; WhatsApp + pas d’expiry |
| Double identité admin/métier | ✅ | Login → espace métier ; bandeau backoffice |
| Backoffice RBAC | ✅ | `requireAdminSection` sur APIs |
| Wallet / retraits | 🟡 | Plus de faux succès ; payout dépend FeexPay |
| Coopérative UX | 🔴 | Hors shell ; 0 coop en prod snapshot ; catalogue manquant |
| Yelly (Gemini) | ✅ | Ops + vendeur quotés |
| OneSignal push | 🟡 | Configurée ; smoke prod à valider |
| Offline PWA | 🟡 | Texte OK ; photos hors outbox |
| Mobile natif | 🔴 | Volontairement après 1er sept 2026 |
| Tests Vitest | ✅ | ~196 verts ; manquent matrix authz / webhook |

Légende : ✅ livré et vérifié · 🟡 en cours / partiel · 🔴 bloqué ou hors période

---

## ✅ Décisions récentes

| # | Décision | Pourquoi (1 ligne) |
|---|----------|-------------------|
| B-01 | Abo = vendeurs only ; acheteur retail free | Ne pas taxer l’achat = mort marketplace |
| B-02 | Commissions 8 / 6,5 / 5 % | FREE finance acquisition ; Pro = volumes |
| T-01 | FeexPay = tuyau paiement ; escrow applicatif GWA | Pas promettre séquestre bancaire |
| T-02 | PWA d’abord ; mobile natif après 1er sept 2026 | Focus go-live web / ops |
| T-03 | OneSignal ≠ Africa’s Talking | SMS OTP ≠ push — les deux restent |
| P-01 | Double identité : login → métier, pas /admin | Ops avec compte producteur ne perdent pas leur espace |

→ Registre complet : [70-registre-decisions.md](./70-registre-decisions.md)

---

## 🔨 Build log

| Date | Session | Ce qui a bougé |
|------|---------|----------------|
| 2026-08-06 | Agent | Exécution **GWA OS** (modèle Notion Shizu) en markdown repo |
| 2026-08-03 | Agent | Audit v2 ; correctifs P0/P1 (RBAC, 056, escrow held, panier, confirm 1 tap) |
| 2026-08-03 | Agent | Séparation double identité + admin abonnements |
| 2026-07-31 | Agent | A11y Acc-1, Yelly Ops, fix /dashboard ≠ /admin |
| 2026-07-28 | DG | Décision pricing / monétisation verrouillée |
| 2026-07-29 | Ops doc | État des lieux : FeexPay + AT_SENDER_ID = P0 |

*(Ne jamais purger ce journal.)*
