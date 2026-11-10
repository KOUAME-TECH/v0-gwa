# ASVS 4.0 — cartographie chat GWA (extrait)

**Date** : 2026-11-02 · Excellence Protocol

| Contrôle | Niveau | Statut | Preuve |
| --- | --- | --- | --- |
| V1.2.1 Threat model chat | L1 | OK | Docs excellence + RLS policies |
| V2.1.1 Password strength | L1 | WARN | Advisor HIBP — ACTION HUMAINE |
| V3.2 Session / auth gate | L1 | OK | `/messages` → login redirect (Playwright) |
| V4.1 Access control media | L2 | OK | Bucket privé 068 + sign participants |
| V5.1 Input validation | L1 | OK | Zod prepare/sign ; sanitizeFileName |
| V5.3.3 Output encoding | L1 | OK | `escapeHtml` PO print |
| V9.1 CSRF | L1 | OK | `assertSameOrigin` routes media |
| V11.1 Rate limiting | L1 | OK | `checkRateLimit("CHAT_UPLOAD")` |
| V13.1 API generic errors | L1 | OK | Messages FR sans stack |
| V14.1 Build / secrets | L1 | OK | Pas de secrets commit ; GeniusPay non touché |

## Écarts

- HaveIBeenPwned Auth : dashboard Supabase
- E2E auth offre→PO : compte test manquant
