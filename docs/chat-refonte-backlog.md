# Chat GWA — backlog Missions 5–9

Mission 1–3 livrées sur `gwa/chat-refonte-whatsapp-1e99`. Ne pas démarrer 5–9 tant que M1–3 ne sont pas stables en prod.

## Mission 5 — Groupes & broadcast
- Conversations multi-participants stables
- Mentions @membre, droits admin groupe
- Diffusion ciblée (coopérative → membres)

## Mission 6 — Médias avancés
- Vidéo courte compressée
- Galerie conversation
- Preview PDF inline

## Mission 7 — Négociation assistée
- Historique d’offres / contre-offres structuré
- Suggestions de fourchette (données marché) sans conclure

## Mission 8 — Modération & confiance
- Signalement → file support
- Blocage utilisateur
- Score confiance visible dans le header chat

## Mission 9 — Observabilité
- Métriques envoi / lecture / upload fail
- Alertes rate-limit conseil IA
- Dashboard ops chat (sans PII)

## Hors scope confirmé
- Ne pas modifier GeniusPay / FeexPay / routes `/api/orders/[id]/pay`
- Bouton « Payer maintenant » = lien vers flux commandes existant
