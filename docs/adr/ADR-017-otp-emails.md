# ADR-017 — Politique OTP et e-mails transactionnels

- **Statut :** Proposé (Lot D, 25 novembre 2026, Africa/Abidjan), à valider par Yao
- **Périmètre :** `lib/auth/otp-store.ts`, `app/api/auth/send-otp`, `app/api/auth/verify-otp`, `lib/email/templates.ts`, `emails/`

## Contexte

La directive t127u exige :
- un OTP qui expire en 5 min ;
- un usage unique ;
- 5 tentatives par heure et par numéro.

Avant le Lot D, le code appliquait :
- une durée de vie de 10 min ;
- 5 essais par code ;
- 5 requêtes par 15 min et par numéro, soit jusqu’à 20 par heure ;
- aucun verrou contre deux vérifications simultanées.

Pour les e-mails, la réinitialisation et la confirmation de compte passent par Supabase Auth. Aucun e-mail de confirmation de commande n’existe : l’acheteur reçoit une notification in-app et un push OneSignal. Le domaine mygwa.org utilise Zoho Mail (MX). Les enregistrements DNS sont les suivants :
- SPF : `include:zoho.com ~all` ;
- DMARC : `p=quarantine` ;
- DKIM : aucun sélecteur courant trouvé.

## Décision

1. `OTP_POLICY` fixe les règles OTP :
   - TTL de 300 s ;
   - 5 essais par code ;
   - 5 vérifications par heure et par numéro (`OTP_VERIFY_H:`) ;
   - 5 envois par heure et par numéro (`OTP_SEND_H:`), en plus du délai de 55 s ;
   - un verrou de vérification de 30 s, et la suppression du code à la validation.
2. Le SMS annonce « Valable 5 min ».
3. Les gabarits e-mail GWA (logo, couleurs, lien unique vers mygwa.org, version texte) sont versionnés :
   - `emails/password-reset.supabase.html` est à coller dans Supabase Auth → Email Templates ;
   - `renderOrderConfirmationEmail` est prêt pour un envoi SMTP Zoho.

## Alternatives

- Resend ou un autre fournisseur transactionnel : meilleure délivrabilité et webhooks, mais un nouveau sous-traitant à déclarer.
- Garder les e-mails par défaut de Supabase : expéditeur générique, et une limite d’envoi basse sans SMTP personnalisé.

## Conséquences

Les actions suivantes demandent toutes le go de Yao :
- publier la clé DKIM Zoho dans le DNS (Vercel DNS) ;
- configurer le SMTP Zoho dans Supabase Auth ;
- coller le gabarit ;
- faire un test mail-tester ;
- brancher l’envoi de la confirmation de commande.

Aucun test réel d’OTP ou d’e-mail vers un tiers ne doit avoir lieu sans ce go.
