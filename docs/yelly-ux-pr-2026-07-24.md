# Yelly UX + suggestions (PR)

## Règle déploiement
**Aucune implémentation ne va en prod sans PR validée.** Branche → PR → review → merge `main`.

## Changements UX
- **Desktop / tablette (`lg+`)** : composition capture (top nav texte + feed 3 col). Yelly via lien **Aide** dans la nav — **plus de FAB terracotta**.
- **Téléphone** : bottom nav inchangée ; pastille discrète verte **« Y »** (icône seule) au-dessus de la nav.

## Suggestions validées (cette PR)
| # | Item | Statut |
|---|------|--------|
| 1 | LLM `YELLY_API_KEY` | déjà branché — à configurer Vercel |
| 2 | Guest mode 3 messages | ✅ cookie `yelly_guest_n` |
| 3 | OneSignal origine | ⚠️ dashboard (pas code) — checklist ci-dessous |
| 4 | CSP nonce | reporté (invasif Next) — doc |
| 5 | Escalade humaine | ✅ `POST /api/yelly/escalate` → inbox support |
| 6 | Mémoire session | ✅ `GET /api/yelly/history` |
| 7 | Analytics | ✅ `yelly_open` / `yelly_resolved` / `yelly_escalate` |

### OneSignal (manuel)
OneSignal → Settings → Platforms → Web → Add origin :
`https://v0-gwa-mu.vercel.app` (+ previews `*.vercel.app` si besoin).
