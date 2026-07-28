# État des lieux GWA — fait, décisions, à faire

**Date :** 28 juillet 2026  
**Périmètre :** produit · business plan · ops go-live · politiques compte / coop  
**Sources :** repo `main`, docs décision juillet, prod `v0-gwa-mu.vercel.app`

---

## 1. Photo nette

| Couche | État | Commentaire |
|--------|------|-------------|
| Produit PWA | **Fort** | Live, healthy, escrow métier en code, feed, panier, admin, SCG v1 |
| OTP / SMS | **OK ops** | OTP reçoit désormais ; AT live à confirmer Sender ID |
| Yelly | **Code prêt** | Gemini branché ; **clé absente sur Vercel** (`GEMINI_API_KEY: false`) |
| Types de compte | **Verrouillé** | Plus de self-service ; admin / service_role seulement |
| Coops — qualification | **Règle + code** | 15 membres / 14 j · docs 6 mois · restrictions M3+ |
| Coops — multi-gestion | **Livré (cette itération)** | admin + manager + member ; habilitation UI/API |
| Pricing | **Décidé, pas codé** | Grille DG 28/07 ≠ code `service-fee` / commission |
| FeexPay | **Bloquant go-live** | Pas d’escrow natif ; `payment_url` encore à finaliser ; sandbox |
| Banques | **Clair** | Partenaires, jamais concurrents |
| Seed / BP | **Draft** | Investissable après P0 chiffres + traction + grille unique |

---

## 2. Ce qui a été fait (livré)

### Produit / technique
- PWA GWA en production (Next.js / Vercel / Supabase).
- Auth OTP (Africa’s Talking) opérationnelle côté réception SMS.
- Escrow **applicatif** (orchestration GWA + agrégateur), pas séquestre FeexPay.
- SCG v1, feed, marketplace, dashboards, admin back-office.
- Yelly : client Gemini (`gemini-flash-latest`) + fallback mots-clés ; docs ops `docs/yelly-gemini.md`.
- **Gel du type de compte** : UI profil lecture seule, PATCH profil sans `user_type`, trigger SQL `049`.
- **Politique coop progressive** : `lib/cooperatives/validation-policy.ts`, création `POST /api/cooperatives` en `pending_validation`, deadlines 14 j / 6 mois.
- **Multi-gestion coop** (28/07) :
  - rôles `admin` | `manager` | `member` (`lib/cooperatives/roles.ts`) ;
  - RLS multi-managers (`050_coop_multi_managers.sql`) ;
  - `PATCH /api/cooperatives/members` pour habiliter ;
  - join via service_role (fix `coop_id` sous trigger 049) ;
  - dashboard : badges, sélecteur de rôle, bandeau qualification.

### Documentation stratégique
| Doc | Contenu |
|-----|---------|
| `politique-cooperatives-types-compte.md` | Qualification + lock type + multi-gestion |
| `decision-strategique-pricing-gwa-2026-07-28.md` | Grille revenus DG |
| `aide-decision-gwa-2026-07-27.md` | 7 arbitrages go-live |
| `analyse-dossier-feexpay-2026-07.md` + réunion | FeexPay / escrow |
| `positionnement-partenaires-bancaires.md` | Banques = partenaires |
| `analyse-business-plan-2026-07-27.md` | Audit BP + P0/P1/P2 |

---

## 3. Décisions prises (retenues)

| # | Décision | Statut |
|---|----------|--------|
| D1 | Escrow = **applicatif GWA** via partenaire agréé (pas attendre séquestre FeexPay) | Retenue |
| D2 | FeexPay court terme + filet plan B ; **pas d’exclusivité 12 mois** avant live prouvé | Retenue |
| D3 | Revenus : abo **vendeur** Free / Starter **7 500** / Pro **18 000** / Enterprise devis ; commission **8 / 6,5 / 5 %** sur vendeur ; acheteurs retail gratuits | Retenue DG 28/07 |
| D4 | Gros individuels → PRO ; coops structurées → ENTERPRISE (ou PRO si petite) | Retenue |
| D5 | Banques / IMF = **partenaires** | Doctrine |
| D6 | Type de compte **non modifiable** en self-service | Retenue + codé |
| D7 | Coop = « en validation » → 15 membres / 14 j + docs / 6 mois ; restrictions avancées dès M3 ; base maintenue | Retenue + codé |
| D8 | Coop gérable par **plusieurs personnes habilitées** (admin + managers) | Retenue + codé |
| D9 | Go-live escrow seulement si pay-in + payout test OK (sinon soft launch sans promesse escrow) | Retenue |
| D10 | Affacturage = différenciation An.1, pas revenu principal | Retenue |

---

## 4. Ce qu’il reste à faire

### P0 — Go-live / crédibilité (bloquant)
1. **Vercel :** ajouter `GEMINI_API_KEY` (clé **régénérée** — celle du chat est exposée) + redeploy.  
2. **FeexPay :** sandbox, `payment_url` réel, pay-out à confirmation livraison.  
3. **Pricing dans le code :** commission vendeur par palier ; retirer double prise frais acheteur.  
4. **Africa’s Talking :** confirmer Sender ID / username live (`SMS_AT_SENDER_ID` encore false en health).  
5. **Migration `050`** appliquée sur Supabase prod (multi-managers RLS).  
6. **CGV / avis juridique** court sur détention / ordre de fonds (escrow applicatif).

### P1 — Produit coop & confiance
7. Upload / dépôt documents légaux coop + sync `validation_status`.  
8. Gates UI sur features avancées selon `evaluateCoopQualification`.  
9. Admin GWA : valider/qualifier coop, changer `user_type` exceptionnel.  
10. Invitations nominatives (email/SMS) + audit log des habilitations.  
11. Bannières qualification sur tous les parcours coop.

### P2 — Business / Seed
12. Unifier chiffres BP (F1–F6) avec grille pricing retenue.  
13. Page traction (même à 0 au début) + métriques soft 4–8 semaines.  
14. Pilote SIDONOBIEL écrit (durée, PRO offert/50 %, non auto-renouvelable).  
15. Avenant FeexPay sans exclusivité longue.

---

## 5. Multi-gestion — règle courte (référence)

- **Administrateur** : gouverne + habilite.  
- **Gestionnaire** : pilote au quotidien (invitations, opérations).  
- **Membre** : participe.  
- Toujours ≥ 1 administrateur.  
- Le type de compte utilisateur reste verrouillé ; l’habilitation se fait **dans** la coop, pas en changeant de type de compte.

---

## 6. Recommandation d’exécution (ordre)

1. Clé Gemini (rotée) sur Vercel.  
2. Migration `050` + smoke test habilitation manager.  
3. FeexPay sandbox + 1 parcours pay-in → confirm → pay-out.  
4. Brancher grille pricing dans les commandes.  
5. Soft launch SIDONOBIEL avec onboarding multi-gestionnaires.

**Phrase de synthèse :** le produit et les règles métier critiques (lock type, qualification coop, multi-gestion) sont posés ; le go-live escrow et le pricing code restent les deux chantiers qui décident du calendrier.
