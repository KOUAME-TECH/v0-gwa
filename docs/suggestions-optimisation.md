# Suggestions d’amélioration GWA

Priorisées après audit + optimisations du 24 juil. 2026.  
**Prod :** https://v0-gwa-mu.vercel.app

## Déjà livré (cette vague)

| Optimisation | Effet |
|--------------|--------|
| Feed : auth + produits + posts **en parallèle** | 1er paint plus rapide |
| Stories rail réutilise les produits du feed | −1 requête catalogue |
| WeatherWidget en `dynamic()` | Moins de JS initial |
| SW OneSignal = offline v19 + shell | PWA réellement hors-ligne |
| Images Next : cache 24h + sizes | Moins de re-fetch images |
| GPS marketplace `maximumAge` 5 min | Batterie / Nominatim |
| Skeleton `app/loading.tsx` | Perception de vitesse |

---

## P0 — Impact immédiat (produit / trust)

1. **FeexPay live** — brancher `payment_url` réel ; webhook déjà sécurisé (montant).
2. **HIBP** — activer Leaked Password Protection (Advisor WARN).
3. **Admin finances / settings** — migrer vers `/api/admin/*` (service role) : pages vides sous RLS aujourd’hui.

## P1 — Perf & scalabilité

4. **Pagination cursor** feed + marketplace (« Charger plus ») au lieu de `limit(20/60)`.
5. **Contexte badges nav** — un store partagé (notifs / cart / orders) pour éviter le double `getUser` Home ↔ BottomNav.
6. **RSC feed** — premier lot de produits en Server Component + hydrate (moins de JS client).
7. **`memo(FeedCard)`** + callbacks stables — moins de re-renders au like.
8. **Retirer `typescript.ignoreBuildErrors`** — rattraper les erreurs TS progressivement.

## P2 — UX métier (CI / mobile)

9. **Mode bas débit** — images `quality={60}` + placeholder blur ; désactiver autoplay vidéo.
10. **Panier guest** → merge à la connexion (moins de friction Acheter).
11. **Recherche** — suggestions produits + vendeurs avec debounce 200ms côté API.
12. **OneSignal** — demander la permission **après** un geste (pas au load) → moins d’erreurs « Permission blocked ».
13. **Offline drafts** — publier / message en file (`lib/offline/drafts` déjà amorcé).

## P3 — Croissance & différenciation

14. **Digest Harmattan** — push localisé ville (déjà cron) + CTA « Écouter » sur chaque notif.
15. **SCG v2** — contrat FastAPI (`docs/scg-v2-fastapi-contract.md`) post-bêta.
16. **Score vendeur visible** sur carte produit (confiance).
17. **WhatsApp deep-link** partage offre (conversion hors app).

---

## Métriques à suivre

- LCP / INP home & marketplace (Vercel Analytics / Speed Insights)
- Taux d’acceptation push OneSignal
- Funnel Acheter → payé → confirmé
- Erreurs `/api/orders/*` et webhook FeexPay

## Règle d’or

Une feature = `lib/<domaine>` + `app/api/<domaine>` + UI.  
Voir [`architecture.md`](./architecture.md).
