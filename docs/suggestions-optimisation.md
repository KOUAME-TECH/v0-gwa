# Suggestions d’amélioration GWA

**Prod :** https://v0-gwa-mu.vercel.app

## Vague « elite » (dernière)

| Optimisation | Effet |
|--------------|--------|
| LCP feed/shop : `priority` + `fetchPriority` 1ères images | Paint média plus rapide |
| Scroll infini (`IntersectionObserver` + bouton a11y) | Moins de friction |
| Prefetch produit (route + `sessionStorage`) | Acheter quasi-instantané |
| CommentComposer + YellyPanel en `dynamic()` | Moins de JS initial |
| OneSignal en idle (4–5 s) | Bande passante pour le feed |
| Middleware : public GET sans cookie → skip `getUser` | TTFB plus bas |
| `startTransition` onglets/filtres | UI plus fluide |
| Trim `is_fair_trade` du select feed | Moins d’octets 3G |

## Déjà livré avant

Hors-ligne (feed/boutique/panier guest), badges store, bas débit, admin API, SW v20, etc.

## Manuel ops

1. HIBP Supabase  
2. FeexPay live  
3. (Option) Vercel Speed Insights
