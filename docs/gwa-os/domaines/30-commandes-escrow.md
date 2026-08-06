# 📦 Commandes & Escrow

**Domaine stable** — cycle transactionnel, statuts, notifications, FeexPay.

---

## État actuel

- Flux codé : **pay-in → held → (ship) → confirm acheteur → payout → released**.
- Si payout échoue : commande **delivered**, escrow reste **`held`** (retry ops) — corrigé 2026-08-03.
- Panier : n’envoie plus vers confirmation si paiement impossible (message FR + WhatsApp).
- Acheteur : CTA **« J’ai reçu »** sur le home.
- Litiges : gel escrow (`frozen`).
- **Prod :** clés FeexPay absentes au dernier health → **pas d’encaissement réel**.

## Règles établies

1. **Escrow = applicatif GWA** + tuyau FeexPay — ne pas promettre séquestre bancaire (T-01).
2. Commission GWA ≠ frais FeexPay (afficher à part).
3. Confirm acheteur = déclencheur payout vendeur (net commission).
4. OneSignal = push commande ; SMS Africa’s Talking = auth seulement.
5. Simulation paiement uniquement hors prod / flag explicite.

## Statuts utiles

| escrow_status | Sens |
|---------------|------|
| pending | Pas encore payé / pas held |
| held | Fonds sécurisés (payé) |
| released | Vendeur payé (payout OK) |
| frozen | Litige |

## Notifications

| Événement | Canal |
|-----------|-------|
| OTP login | SMS (AT) |
| Paiement / confirm / payout | In-app + OneSignal push |
| Digest Harmattan | Cron + push |

## Questions ouvertes

- File admin « payouts failed » dédiée ?
- Timeline escrow UX O1–O6 (v3) avant soft-launch ?
- CinetPay en secours — décision datée ?

## Liens repo

- `docs/avis-cinetpay-vs-feexpay-2026-07-28.md`
- `lib/orders/escrow-flow.ts`
- `app/api/orders/[id]/pay|confirm/`
- `docs/onesignal-vs-africas-talking.md`
