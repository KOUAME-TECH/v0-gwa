# Gouvernance de l’IA de GWA : Yelly

- **Version :** 1.0, 25 novembre 2026 (Africa/Abidjan)
- **Référentiel :** structure inspirée de l’ISO/IEC 42001:2023 (système de management de l’IA). GWA n’est **pas certifiée ISO 42001** ; ce document sert de base à une démarche future.
- **Propriétaire :** KOUAME CORPORATION (GWA). Responsable du système d’IA : [À COMPLÉTER, nom et rôle].
- **Mention affichée à l’utilisateur :** « Yelly est une assistante, pas une décision financière. »

## 1. Périmètre (ISO 42001 §4.3)

| Élément | Valeur |
|---|---|
| Système | Yelly, assistante conversationnelle de la PWA GWA (aide, conseil dans le chat acheteur–vendeur) |
| Points d’entrée | `POST /api/yelly/chat` (panneau Yelly, bouton « Conseil IA » du chat), `POST /api/admin/ai/assist` (back-office, hors périmètre utilisateur) |
| Hors périmètre | Toute décision automatisée : prix imposé, octroi de crédit ou d’affacturage, libération de fonds, notation SCG. Yelly n’écrit rien en base métier hormis son propre historique (`yelly_conversations`, `yelly_messages`) |
| Utilisateurs | Producteurs, coopératives, acheteurs, visiteurs (3 questions par 24 h) |

## 2. Rôles et responsabilités (§5.3)

| Rôle | Responsabilité |
|---|---|
| CEO (Yao Kouamé) | Valide la politique IA, les changements de modèle et de fournisseur |
| Produit / Code | Prompts, capacités, tests, journalisation |
| QA & Sécurité | Revue de chaque changement (PII, rate limit, abus), tests de non-régression |
| Support | Traite les signalements de réponses erronées (WhatsApp, `contact@mygwa.org`) |

## 3. Cycle de vie (§8, annexe A.6)

| Étape | Pratique GWA | Preuve |
|---|---|---|
| **Données d’entraînement** | GWA **n’entraîne ni n’affine** aucun modèle. Aucune donnée utilisateur n’est envoyée pour l’entraînement. Les conditions du fournisseur (API Gemini payante) excluent l’usage des requêtes pour l’entraînement : [À VÉRIFIER, contrat et paramètres du compte Google Cloud] | — |
| **Modèle** | Google Gemini, `gemini-3.1-flash-lite` par défaut (`YELLY_MODEL` / `GEMINI_MODEL`). Repli OpenAI-compatible si configuré, puis repli par mots-clés sans IA | `lib/yelly/client.ts` |
| **Prompts** | Prompt système versionné dans le dépôt (`YELLY_SYSTEM_PROMPT`). Consignes par capacité (prix de référence, reformulation, détection d’accord, bon de commande) | `lib/yelly/prompt.ts`, `lib/yelly/capabilities.ts` |
| **Contexte** | Rôle de l’utilisateur, produit (nom, prix, ville, prix de référence OCPV), 8 derniers messages du chat (participant seulement, messages IA exclus) | `lib/yelly/context-builder.ts`, `lib/yelly/context.ts` |
| **Minimisation / PII** | Tout texte envoyé passe par `redactPiiForAi` : e-mail, téléphone, adresse (rue, BP), GPS, carte, code OTP masqués. Aucune donnée vendeur (nom, téléphone) n’est chargée | `lib/yelly/pii.ts`, `tests/yelly-lot-d.test.ts` |
| **Sorties** | Texte brut assaini (`sanitizePlainText`, 2 000 caractères max), sans markdown. Montants marqués indicatifs. Mention de non-décision affichée sous les réponses | `app/api/yelly/chat/route.ts`, `components/yelly/yelly-panel.tsx` |
| **Contrôles d’usage** | Quota par jour selon le palier, 10 appels/minute par utilisateur (Upstash, repli mémoire), limite IP, CSRF, validation zod | `lib/yelly/rate-limit.ts` |
| **Cache** | FAQ validées servies sans modèle (`source: faq`), cache mémoire 1 h des réponses génériques sans contexte | `lib/yelly/faq-cache.ts` |
| **Journalisation** | Historique Yelly en base (RLS propriétaire). Logs serveur : erreurs HTTP du fournisseur, `[yelly] rate_limited` (id utilisateur tronqué à 8 caractères). Pas de contenu de message dans les logs | Logs Vercel |
| **Retrait** | Désactivation : retirer la clé `GEMINI_API_KEY` ; Yelly bascule sur le repli par mots-clés sans IA | `lib/yelly/client.ts` |

## 4. Évaluation des risques (§6.1, A.5)

| Risque | Impact | Mesure | Risque résiduel |
|---|---|---|---|
| Fuite de PII vers le fournisseur | Élevé | `redactPiiForAi` + tests sur la charge utile réelle | Faible (filtre de surface : noms propres non masqués) |
| Conseil de prix pris pour une décision | Moyen | Fourchette ±10 % explicite, mention « pas une décision financière » | Faible |
| Hallucination (chiffre inventé) | Moyen | Consigne « n’invente jamais un chiffre absent du contexte », chiffres calculés côté serveur | Moyen |
| Partialité dans une négociation | Moyen | Rôle de « conseiller neutre » dans le chat | Faible |
| Abus / coût | Moyen | Quotas, 10/min/utilisateur, limite IP, invités à 3/24 h | Faible |
| Injection de prompt via le chat | Moyen | Messages IA exclus du contexte, sorties en texte brut, aucune action automatique | Faible |

## 5. Transparence envers l’utilisateur (A.8)

- Yelly se présente comme une IA (« Conseil de l’IA — Neutre »), ses messages dans le chat portent le préfixe « [Conseil IA] ».
- La politique de confidentialité cite Google (Gemini) comme sous-traitant et décrit le masquage des PII.

## 6. Surveillance et amélioration (§9, §10)

- Revue trimestrielle : taux de repli (`source: fallback`), part des FAQ servies en cache, signalements support. [À COMPLÉTER : tableau de bord]
- Tout changement de modèle, de prompt ou de capacité passe par une PR revue par QA & Sécurité.
- Incident IA (fuite, réponse dangereuse) : suivre la procédure d’incident sécurité, notifier l’ARTCI si des données personnelles sont concernées (loi n° 2013-450).
