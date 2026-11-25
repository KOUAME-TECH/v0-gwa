# Documents juridiques GWA : checklist de conformité (25/11/2026)

| Exigence (directive t127u, phase 3) | Statut | Où |
|---|---|---|
| CGU : GeniusPay cité comme prestataire de paiement | Fait | `app/conditions/page.tsx` §6 (`/conditions`) |
| CGU : séquestre applicatif GWA (et pas séquestre bancaire / GeniusPay) | Fait | `/conditions` §6 |
| CGV : tarifs officiels (250 F acheteur, paliers producteurs et coopératives) | Fait | `/conditions` §6 bis |
| CGU : ARTCI / loi n° 2013-450 | Fait | `/conditions` §12 bis |
| CGU : droit applicable OHADA, juridiction Abidjan | Fait | `/conditions` §13 |
| Wallet masqué jusqu’à l’agrément BCEAO | Fait | `/conditions` §6 |
| Yelly : mention « pas une décision financière » | Fait | `/conditions` §8 bis, `docs/ai-governance.md` |
| FeexPay supprimé des textes et du code applicatif | Fait | `lib/routes/inventory.ts`, `lib/yelly/client.ts`, `docs/chat-refonte-backlog.md`. Restent volontairement : migrations SQL historiques (immuables), CDC v2.0 et ADR-012 (documentent le remplacement) |
| Confidentialité : loi 2013-450, ARTCI | Fait | `app/confidentialite/page.tsx` §1, §6 (`/confidentialite`) |
| Confidentialité : contact DPO / référent | Fait (contact@mygwa.org, objet « Données personnelles ») | `/confidentialite` §1 |
| Confidentialité : droit à l’effacement et ses limites légales | Fait | `/confidentialite` §6 bis |
| Confidentialité : Google Gemini déclaré comme sous-traitant | Fait | `/confidentialite` §4 |
| MOU coopératives : résiliation, propriété des données, confidentialité, 2 ans | Créé (aucun MOU n’existait) | `docs/legal/mou-cooperatives.md` art. 4 à 7 |
| Label Startup numérique (LF 2026, 3 ans) | Brouillon, non soumis | `docs/legal/label-startup-numerique.md` |

## Points ouverts (décision ou information de Yao)

- [À CONFIRMER] Déclaration ou autorisation des traitements auprès de l’ARTCI : numéro et date. Les textes ne l’affirment pas tant qu’elle n’est pas confirmée.
- [À CONFIRMER] Désignation formelle d’un DPO (nom) ; adresse dédiée (ex. `dpo@mygwa.org`) à créer si souhaité.
- Relecture par un conseil juridique avant de retirer le bandeau « bêta / en cours de revue ».
