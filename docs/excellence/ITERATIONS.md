# GWA Excellence Protocol — Journal d’itérations

Branche : `gwa/excellence-protocol-8459` · Base main `c51133f` (#25)  
Prod audit : https://mygwa.org · **Pas de merge/deploy** tant que Global < 95 après ≥10 itérations.

## MCP

| MCP | Statut |
| --- | --- |
| Supabase | OK — advisors + SQL RLS |
| Playwright | OK — screenshots 320/1024 |
| Vercel | Dispo lecture ; **prod deploy INTERDIT** ici |
| Notion | OK — page rapport |
| Upstash | Via code `lib/security/upstash.ts` + `job-queue.ts` (pas de MCP Redis dédié) |
| Context7 / Sentry MCP | **Manquants** — fallback docs + code Sentry configs |
| GitHub | `gh` CLI |

## ITÉRATION 1

**Scores** : Global **72** | UI/UX **78** | Frontend **80** | Backend **70** | Audio **48** | Négociation **74** | Sécurité **82** | IA **68** | Continuité **55**

### Écarts

- [FAIT VÉRIFIÉ] XSS print bon de commande (noms/produit injectables) → corrigé `escapeHtml`
- [FAIT VÉRIFIÉ] Schema prepare size max 10 Mo alors que vocal 12 Mo → aligné
- [FAIT VÉRIFIÉ] Offre sans qty/lieu/délai structurés → enrichi
- [FAIT VÉRIFIÉ] getUserMedia sans noiseSuppression → activé
- [FAIT VÉRIFIÉ] Escape overlays manquant → ajouté
- [FAIT VÉRIFIÉ] RLS messages/conversations + storage chat_media_* présentes
- [FAIT VÉRIFIÉ] Advisor : leaked password protection disabled
- [FAIT VÉRIFIÉ] Bucket chat-media `public=true` (fallback public URL)
- [HYPOTHÈSE] TTS/STT studio absents — score Audio bas
- [ACTION HUMAINE REQUISE] Enable HaveIBeenPwned + verify Supabase PITR
- [RISQUE RÉSIDUEL] Pas de QR graphique ; code vérif texte seulement

### Corrections

- `lib/chat/purchase-order.ts`, `offer.ts`, `upload.ts`
- `components/chat/chat-conversation.tsx` (offre structurée, audio, Escape)
- `lib/security/job-queue.ts` (file Upstash)
- Docs gouvernance IA + continuité + preuves Playwright

### Preuves

- Screenshots : `docs/excellence-evidence/iter1-login-320.png`, `iter1-login-1024.png`
- Tests vitest chat + XSS PO
- Supabase advisors security/performance

### MCP utilisés

Supabase, Playwright, Notion (si page créée), cursor-cloud, gh

### Décision

**Itération suivante** (Global 72 < 95)

### Lien Notion

https://app.notion.com/p/40ca6d3a76b481d3949fdb46d9a0081e

---

## ITÉRATION 2

**Scores** : Global **76** | UI/UX **82** | Frontend **82** | Backend **72** | Audio **62** | Négociation **78** | Sécurité **86** | IA **76** | Continuité **58**

### Corrections [FAIT VÉRIFIÉ]
- STT parallèle Web Speech + affichage transcription sous vocal
- Refus jailbreak conseil IA + prompt encapsulé
- Sign media : suppression fallback URL publique
- Spinner messages brand GWA + aria attach

### Preuves
- tests `voice-stt.test.ts`, adversarial IA
- route `sign` 404 si sign échoue

### Décision
Itération suivante

---

## ITÉRATION 3

**Scores** : Global **79** | UI/UX **84** | Frontend **84** | Backend **74** | Audio **68** | Négociation **82** | Sécurité **86** | IA **78** | Continuité **60**

### Corrections
- Offre : `role=dialog`, focus `#offer-amount`, champs qty/lieu/délai (suite)
- TTS « Écouter » sur bulles Conseil
- Glyphe SVG suivi sur bon imprimable (+ code vérif)
- Migration `067_chat_group_fk_indexes.sql` (fichier)

### Décision
Itération suivante

---

## ITÉRATION 4

**Scores** : Global **81** | UI/UX **85** | Frontend **85** | Backend **80** | Audio **70** | Négociation **84** | Sécurité **88** | IA **80** | Continuité **65**

### Corrections [FAIT VÉRIFIÉ]
- Indexes group chat 067 appliqués (Supabase MCP) — unindexed FK chat groupes résolus
- Preview vocal affiche transcription avant envoi
- Plan test manuel + rapport validation §10

### Décision
Itération suivante (81 < 95) — **NO-GO merge**

---

## ITÉRATIONS 5–10 (plan restant)

| N | Focus | Cible score |
| --- | --- | ---: |
| 5 | Bucket chat-media private + clients sign-only | Sécurité 92 |
| 6 | QR ISO (lib) + Playwright auth offre→PO | Négociation 90 / Global 85 |
| 7 | DSP / qualité audio + offline STT | Audio 85 |
| 8 | Observabilité chat (métriques sans PII) | Backend 88 |
| 9 | Exercice restore + runbook continuité | Continuité 85 |
| 10 | Audit WCAG complet + score ≥95 ou NO-GO final | Global ≥95 |
