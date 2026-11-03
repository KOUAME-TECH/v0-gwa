# ISO/IEC 25010:2023 — Parcours Producteur

| Caractéristique | Score estimé | Preuve |
| --- | ---: | --- |
| Adéquation fonctionnelle | 88 | Publier → annonces → ventes → wallet → KYC |
| Performance efficacité | 80 | Client fetch parallèle ; stats API gated |
| Compatibilité | 82 | Mobile-first + desktop gates Playwright |
| Interaction (UX) | 86 | FR labels, prochaine action, skip links |
| Fiabilité | 78 | Offline publish queue + flush |
| Sécurité | 90 | RLS, CSRF withdraw/KYC, bucket KYC privé |
| Maintenabilité | 84 | Helpers `lib/farmer/*`, tests vitest |
| Flexibilité | 80 | Redirect legacy new product → `/publier` |
