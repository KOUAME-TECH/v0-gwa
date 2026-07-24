# Marque & logo GWA

## Emplacements (source de vérité)

| Fichier | Usage |
|---------|--------|
| **`public/icon.svg`** | Logo vectoriel (G blanc + grain or sur fond `#1F5C2E`) — préféré pour UI nette |
| **`public/icon-master.png`** | Master haute résolution (~700 Ko) — source export PWA / stores |
| **`public/icon-512.png`** | Icône PWA 512×512 (maskable + any) |
| **`public/icon-192.png`** | Icône PWA 192×192 + affichage in-app (`GwaMark`) |
| **`public/icon-32.png`** | Favicon petit |
| **`public/apple-icon.png`** | Apple touch icon |

Composant React : **`components/brand/gwa-mark.tsx`**  
→ affiche `/icon-192.png` (+ wordmark « GWA » optionnel).

Manifest PWA : **`public/manifest.json`** (pointe vers les PNG / SVG ci-dessus).

## Couleurs marque

- Vert : `#1F5C2E`
- Or / grain : `#C27D10`
- Fond chaud (auth / panier) : `#FFF6E5` / `#FFF8F0`

## Où modifier le logo

1. Éditer `public/icon.svg` (ou remplacer `icon-master.png`)
2. Régénérer `icon-192.png`, `icon-512.png`, `icon-32.png`, `apple-icon.png`
3. Vérifier `GwaMark` et le manifest
