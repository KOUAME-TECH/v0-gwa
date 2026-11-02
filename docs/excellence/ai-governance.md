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

## Robustesse (à étendre itérations suivantes)

- Tests unitaires préfixe / prompt.
- Tests adversariaux (jailbreak « ignore instructions ») — backlog.
