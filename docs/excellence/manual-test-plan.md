# Plan de test manuel — Chat GWA (Excellence)

**URLs**
- Prod : https://mygwa.org/messages (auth requise)
- Preview PR : (après draft PR)

## Parcours A — UI chat
1. Login → Messages
2. Ouvrir une conversation (mobile 320 + desktop 1024)
3. Vérifier bulles, ✓✓, typing, long-press (Répondre / Copier / Supprimer / Réagir)
4. Escape ferme overlays
5. Recherche dans le fil

## Parcours B — Audio
1. Enregistrer un vocal (autoriser micro)
2. Vérifier preview + éventuelle transcription
3. Envoyer / annuler
4. Écouter bulle vocale + lire transcription si présente
5. Sur conseil IA : bouton « Écouter » (TTS)

## Parcours C — Négociation
1. Pièce jointe → Négocier
2. Remplir prix, quantité, lieu, délai
3. Envoyer offre → accepter (double confirm) → bon épinglé
4. Imprimer bon → vérifier code + glyphe + absense XSS
5. « Payer maintenant » → dashboard commandes (pas GeniusPay modifié)

## Parcours D — Offline
1. DevTools Offline → envoyer texte → file locale
2. Online → flush

## Parcours E — Sécurité smoke
1. Upload MIME invalide → refus
2. Vocal > 12 Mo → refus
3. `/api/chat/media/sign` sans auth → 401
