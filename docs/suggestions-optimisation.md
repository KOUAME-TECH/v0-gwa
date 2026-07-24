# Suggestions d’amélioration GWA

**Statut :** toutes les suggestions code validées — livrées sur `main` (juil. 2026).  
**Prod :** https://v0-gwa-mu.vercel.app

## Livré

| Item | Statut |
|------|--------|
| Feed parallèle + Stories sans 2e fetch | ✅ |
| WeatherWidget dynamic + skeleton | ✅ |
| SW offline v20 (OneSignal + shell) | ✅ |
| Cache images / GPS 5 min | ✅ |
| Badges nav partagés | ✅ |
| Mode bas débit (`/profil/edit`) | ✅ |
| Admin finances & settings → API service role | ✅ |
| Pagination feed « Charger plus » | ✅ |
| `memo(FeedCard)` | ✅ |
| OneSignal permission **après geste** | ✅ |
| Panier guest + merge login | ✅ |
| Partage WhatsApp produit | ✅ |
| **Hors ligne** : feed cache + boutique cache + panier guest + brouillons Publier | ✅ |

## Manuel (hors code)

1. Supabase → **Leaked Password Protection** ON  
2. FeexPay live (`payment_url` marchand)  
3. Speed Insights Vercel (optionnel)

## Hors ligne — comment ça marche

1. Ouvre l’app **une fois en ligne** (feed + boutique se mettent en cache 72 h).  
2. Coupe le réseau → bannière ambre + feed / marketplace depuis le cache.  
3. Ajoute au panier sans compte (charette locale) → à la connexion, fusion auto.  
4. Publier : brouillon IndexedDB repris à la reconnexion.  
5. Service worker `OneSignalSDKWorker.js` sert shell + `/offline.html`.

## Suite optionnelle (post-bêta)

- RSC feed serveur · SCG v2 FastAPI · Digest push ville · retirer `ignoreBuildErrors`
