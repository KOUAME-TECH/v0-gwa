# GWA — Gouvernance IA (ISO/IEC 42001 / NIST AI RMF)

**Statut** : document vivant — Excellence Protocol  
**Périmètre** : conseil in-thread (`@IA` / bouton Conseil), Yelly panel (hors chat transactionnel).

## Cycle de vie

| Étape | Contrôle |
| --- | --- |
| Demande | Uniquement sur action utilisateur (pas de push proactif transactionnel) |
| Prompt | Neutre acheteur–vendeur (`lib/chat/ai-advice.ts`) |
| Validation | Zod + rate-limit `YELLY_CHAT` (Upstash si dispo) |
| Sortie | Préfixe `[Conseil IA]`, bulle rôle `ai`, PII filtrée (`lib/yelly/pii.ts`) |
| Journal | Logs serveur sans corps de message complet |

## Risques & impacts

| Risque | Mitigation |
| --- | --- |
| Biais / prise de parti | Prompt « ne prends pas parti » ; pas de conclusion d’accord |
| Fuite PII | Filtre PII avant envoi LLM |
| Abus coût | Rate-limit distribué |
| Injection prompt | Question utilisateur encapsulée ; pas d’outils paiement |

## Transparence

- Libellé visible « Conseil » / participant IA distinct des humains.
- L’IA ne crée pas de commande ni ne déclenche GeniusPay/FeexPay.

## Robustesse

- Tests unitaires préfixe / prompt (`tests/chat-ai-order.test.ts`).
- Tests adversariaux jailbreak (`isAdversarialAiQuestion` / `adversarialAdviceRefusal`) — **OK**.
- Métriques Sentry sans PII (`trackChatMetric("chat.ai.*")`).
- L’IA ne déclenche jamais GeniusPay / FeexPay.

## Contrôles ISO/IEC 42001 (mapping court)

| Clause | Contrôle GWA | Preuve |
| --- | --- | --- |
| 4 Contexte | Périmètre conseil in-thread + Yelly only | ce document |
| 5 Leadership | Pas d’autonomie paiement / commande | code `ai-advice` + gel GeniusPay |
| 6 Planification | Rate-limit Redis fail-closed 10/min | health `rate_limit_redis` + burst evidence |
| 7 Support | Docs + tests adversarial | `tests/*adversarial*` / chat-ai |
| 8 Fonctionnement | Action utilisateur requise (`@IA` / bouton) | UI chat |
| 9 Évaluation | Advisors + vitest + logs Sentry sans PII | CI locale agent |
| 10 Amélioration | Journal `ITERATIONS.md` + baseline reset 45 | excellence docs |

## Red team (adversarial) — checklist session

- [x] Jailbreak / ignore instructions → refus
- [x] Demande de contourner paiement / escrow → hors scope
- [ ] E2E authentifié conseil→PO (compte test humain requis)
- [x] Rate-limit Yelly prod Redis PASS (infra)
