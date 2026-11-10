# WCAG 2.2 AA — checklist chat GWA

**Date** : 2026-11-02 · Branche excellence

| Critère | Statut | Preuve |
| --- | --- | --- |
| 1.1.1 Textes non textuels | OK | QR `alt`, icônes `aria-hidden`, images chat via resolve |
| 1.3.1 Info et relations | OK | `role=log`, `role=dialog` offre, `role=status` offline/rec |
| 1.4.3 Contraste | PARTIEL | Vert `#1F5C2E` / blanc OK ; méta `#54656f` sur fond clair OK |
| 2.1.1 Clavier | OK | Compose, Escape overlays, focus offre |
| 2.1.2 Pas de piège | OK | Escape ferme attach/offre/search/accept |
| 2.4.1 Bypass blocks | OK | Skip « Aller aux messages » `#gwa-chat-messages` |
| 2.4.3 Focus order | OK | Header → search → log → compose |
| 2.4.7 Focus visible | OK | `focus-visible:outline` brand |
| 2.5.5 Target size | OK | Cibles ≥44×44 (mic, send, back) |
| 3.2.2 À la saisie | OK | Pas de submit auto hors Enter compose |
| 4.1.2 Name, Role, Value | OK | `aria-label` / `aria-pressed` mic & search |
| 4.1.3 Status messages | OK | `aria-live=polite` messages + timer vocal |

## Écarts résiduels

- [ ] Contraste badges secondaires sur bulles colorées (audit visuel manuel)
- [ ] Parcours offre→PO authentifié Playwright (compte test)
