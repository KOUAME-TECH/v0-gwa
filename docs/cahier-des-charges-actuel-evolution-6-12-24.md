# Cahier des charges GWA — état actuel + évolution 6 / 12 / 24 mois

**Produit :** GWA (Guinée We Are) — marketplace agricole P2P + coopératives + escrow applicatif + SCG  
**Version document :** 1.0 · **Date :** 28 juillet 2026  
**Statut :** Référence produit / BP / ops — alignée code `main`  
**Prod :** https://v0-gwa-mu.vercel.app  
**Stack :** Next.js PWA · Vercel · Supabase · FeexPay · Africa’s Talking · OneSignal · Gemini (Yelly)

---

## A. Vision & positionnement

| Élément | Contenu |
|---------|---------|
| **Mission** | Infrastructure de confiance pour le commerce agricole (CI puis UEMOA) |
| **Promesse** | Acheter / vendre avec argent protégé jusqu’à confirmation, score de confiance, offline-first |
| **Ce que GWA n’est pas** | Banque, IMF, réseau social généraliste, e-learning, artisanat |
| **Banques / IMF** | **Partenaires** (deal flow + donnée SCG) — jamais concurrents |
| **Escrow** | **Applicatif GWA** (orchestration + compte marchand agrégateur) — pas séquestre natif FeexPay |
| **Paiement** | FeexPay primaire court terme ; CinetPay = plan B dual (séquestre plus proche BP) ; **pas d’exclusivité 12 mois** avant live prouvé |

---

## B. Périmètre fonctionnel ACTUEL (livré)

### B.1 Modules beta (F1–F6) — en place

| ID | Module | Contenu actuel |
|----|--------|----------------|
| **F1** | Catalogue agri | Marketplace, publier, PDP, favoris, recherche, digest Harmattan |
| **F2** | Commandes / escrow | Panier → commande → pay-in FeexPay → hold → confirm → payout vendeur → facture |
| **F3** | Profils / KYC | Types compte verrouillés ; vérification ; onboarding |
| **F4** | Notifications | OneSignal push + in-app ; digest cron |
| **F5** | Admin | Finances, orders, coops, factoring, export CSV, settings |
| **F6** | SCG | Moteur v1 + coach ; snapshot à la demande d’affacturage |

### B.2 Surfaces utilisateur

| Acteur | Accès |
|--------|--------|
| **Acheteur retail** | Feed, marketplace, panier, commandes, messages, Yelly — **gratuit** (0 abo, 0 frais GWA) |
| **Producteur** | Dashboard farmer, publier, wallet, abonnement, SCG, affacturage si éligible |
| **Coopérative** | Dashboard coop, multi-gestion (admin / manager / member), qualification progressive |
| **Admin GWA** | Back-office finances / vérifs / factoring / export |

### B.3 Hors scope (verrouillé)

Formations, e-learning, B2B marketplace générique, réseau social LinkedIn-like, artisanat, dashboards student/business.  
Source : `docs/scope-beta.md` + redirects `next.config.mjs`.

---

## C. Règles métier figées (décisions DG)

### C.1 Tarification vendeur

| Palier | Prix / mois | Commission GWA | Services délivrés (code) |
|--------|-------------|----------------|--------------------------|
| **FREE** | 0 | **8 %** | ≤ 5 annonces, digest, SCG base |
| **STARTER** | **7 500 FCFA** | **6,5 %** | Annonces illimitées, boost léger, stats vendeur |
| **PRO** | **18 000 FCFA** | **5 %** | Priorité feed/boutique, badge Pro, SCG avancé, priorité affacturage, reporting |
| **ENTERPRISE** | Sur devis (~45 k plancher) | **≤ 5 %** négo | + multi-gestionnaires, account manager ops |

- Acheteur retail : **Free forever** (paie prix catalogue + frais tuyau FeexPay).  
- Commission **uniquement côté vendeur**.  
- Source code : `lib/pricing/entitlements.ts` + `lib/pricing/service-fee.ts`.  
- Activation abo : demande + WhatsApp + admin (paiement abo auto = roadmap).

### C.2 Types de compte

- Fixés à l’inscription / création contrôlée.  
- **Aucun changement self-service** (admin / service_role seulement).  
- Trigger SQL `049` + UI lecture seule.

### C.3 Coopératives

| Phase | Règle |
|-------|--------|
| Création | Statut `pending_validation` — accès **basic** |
| J0 → J14 | ≥ **15 membres actifs** |
| Avant M6 | Documents légaux (RCCM, statuts…) |
| Dès M3 si non conforme | **Avancé restreint** (affacturage, etc.) ; **base maintenue** |
| Multi-gestion | Rôles `admin` \| `manager` \| `member` |

### C.4 Escrow & wallet

1. Acheteur initie pay-in FeexPay (`requesttopay` + éventuelle `payment_url`).  
2. Webhook → `payment_status=paid`, `escrow_status=held`.  
3. Confirm réception → payout vendeur (net commission) + `escrow_status=released` + facture.  
4. Wallet : solde = ventes libérées − retraits ; retrait via FeexPay payout / file ops.  
5. Wording public : « argent protégé jusqu’à confirmation » — **pas** « séquestre FeexPay ».

### C.5 Affacturage

- Différenciation / rétention An.1 — **pas** revenu principal.  
- Éligibilité : rôle producteur/coop + SCG bancable / score ≥ seuil.  
- Priorité file selon palier abo.  
- Décision / décaissement : admin GWA + **partenaire financier**.

---

## D. Exigences non fonctionnelles actuelles

| Domaine | Exigence | État |
|---------|----------|------|
| **PWA / Offline** | SW `gwa-v21-offline` ; outbox publish texte ; cache catalogue / feed ; Yelly offline local | Livré (médias offline = limite) |
| **Auth** | OTP SMS Africa’s Talking | Opérationnel ; Sender ID à confirmer ops |
| **IA** | Yelly + Gemini (`gemini-3.1-flash-lite`) | Livré |
| **Sécurité** | RLS Supabase, rate-limit, HMAC webhook FeexPay, secrets Vercel | Base OK ; rotation Gemini si fuite |
| **Perf mobile** | Data-saver, voice/listen, UI mobile-first | Livré |
| **Observabilité** | `/api/health`, logs Vercel | Partiel |
| **Tests** | Vitest (~177) | Vert local |

---

## E. Architecture technique (contrainte CdC)

```
PWA (Next.js App Router)
  → /api/* (mutations sensibles)
  → Supabase (Postgres + RLS + Storage)
  → FeexPay (pay-in / payout)
  → Africa’s Talking (OTP)
  → OneSignal (push)
  → Gemini (Yelly)
```

- Pas de secret côté client.  
- Migrations versionnées : `scripts/schema/`.  
- Inventaire routes : `lib/routes/inventory.ts`.

---

## F. Critères d’acceptation go-live monétisé

| # | Critère | Seuil |
|---|---------|--------|
| 1 | Health prod vert | `status=healthy`, `sms_delivery_ready=true` |
| 2 | E2E sandbox | 1 commande pay-in → held → confirm → payout → released |
| 3 | Abonnements | Bénéfices = entitlements (pas de promesse non codée) |
| 4 | Soft launch | Invite-only SIDONOBIEL / pilote coop ≤ 90 j |
| 5 | Discours | Escrow applicatif assumé ; banques = partenaires |
| 6 | Juridique | CGV / notice détention fonds sur compte marchand |

---

## G. ÉVOLUTION — 6 / 12 / 24 mois

Horizon zéro = **août 2026** (post-bêta technique actuelle).

### G.1 À 6 mois (≈ février 2027) — « Preuve terrain »

**Objectif :** 1–2 coops pilotes actives, escrow live crédible, conversion abo réelle.

| Thème | Livrables |
|-------|-----------|
| **Paiements** | FeexPay **live** (sortie sandbox) ; E2E quotidien monitoring ; UX « même réseau MM » ; litige / freeze payout documenté |
| **Plan B** | POC CinetPay séquestre **ou** report daté écrit |
| **Abo** | Encaissement Starter/Pro via FeexPay (fin WhatsApp-only) ; activation auto post-paiement |
| **Traction** | SIDONOBIEL + 1 coop ; seed catalogue ; ≥ dizaines de commandes / mois |
| **Ops** | Sender ID SMS vert ; runbook support escrow ; rotation secrets process |
| **Offline** | Outbox médias (photo publish) |
| **Pricing** | Grille actuelle maintenue (7 500 / 18 000) ; promo pilote écrite non auto-renouvelable |
| **KPI cibles** | Conversion abo ≥ 3–6 % vendeurs actifs ; NPS vendeur suivi ; GMV pilote chiffré |

**Hors 6 mois :** API publique Enterprise, multi-pays, crédit auto.

---

### G.2 À 12 mois (≈ août 2027) — « Scale CI + partenaires »

**Objectif :** produit défendable Seed ; banques/IMF branchées en deal flow.

| Thème | Livrables |
|-------|-----------|
| **Pricing** | Si conversion ≥ 6 % et NPS OK → Starter **10 000** / Pro **22 000** (annonce −60 j) |
| **Enterprise** | Reporting contrat, multi-users formalisé, SLA support, option API lecture |
| **SCG** | SCG v2 (5C) + seuil signé avec partenaire ; export dossier bancaire |
| **Affacturage** | File partenaire (pas seulement admin GWA) ; volumes pilote |
| **Dual paiement** | Abstraction `provider: feexpay \| cinetpay` si besoin séquestre / couverture |
| **Compliance** | KYC renforcé volumes ; CGV/RGPD/BCEAO revue ; audit sécurité externe |
| **Produit** | Assistant compte Pro (+1) ; inventaire / sync offline enrichie ; analytics vendeur |
| **Géo** | CI consolidée ; exploration 2ᵉ pays UEMOA (pas go-live massif) |
| **KPI cibles** | ARPU abo défendable ; % litiges escrow < seuil ; 1 MoU banque/IMF |

---

### G.3 À 24 mois (≈ août 2028) — « Plateforme régionale confiance »

**Objectif :** infrastructure multi-pays, partenaires multipliés, marque confiance agri.

| Thème | Livrables |
|-------|-----------|
| **Multi-pays** | 2–3 marchés UEMOA (réseaux MM locaux via agrégateurs) |
| **Partenariats** | Plusieurs banques/IMF ; scoring SCG auditable industrialisé |
| **Financement** | Affacturage / préfinancement à l’échelle (toujours via partenaire agréé) |
| **Enterprise** | API + webhooks marchands ; account managers ; SLA contractuels |
| **Data** | Observabilité paiements ; fraude ; dashboards investisseur |
| **Produit** | Coop outils avancés (stocks collectifs, cotisations) ; B2B acheteur institutionnel (abo outils, jamais péage panier) |
| **Gouvernance** | Agrément / cadre si wallet interne étendu (sinon toujours via agrégé) |
| **KPI cibles** | GMV An.2 ; rétention abo ; NPS ; volume dossiers transmis partenaires |

**Toujours hors doctrine :** devenir banque ; abo obligatoire acheteur retail ; social network hors agri.

---

## H. Matrice synthèse évolution

| Domaine | Aujourd’hui | +6 mois | +12 mois | +24 mois |
|---------|-------------|---------|----------|----------|
| Escrow | Applicatif + FeexPay branché (sandbox→live) | Live stable + litiges | Dual provider éventuel | Multi-pays |
| Abo vendeur | 0 / 7,5k / 18k + gates code | Paiement abo auto | Prix ↑ si traction | Enterprise API/SLA |
| Coops | Qualification + multi-gestion | 1–2 pilotes live | Outils scale | Stocks / cotisations |
| SCG | v1 + coach | Affinage terrain | v2 + banque | Industrialisé |
| Affacturage | File GWA + priorité abo | Volumes pilote | Partenaire finance | Scale |
| Offline | Texte + caches | Médias outbox | Sync riche | Robuste multi-réseau |
| Banques | Doctrine partenaires | MoU exploratoire | 1 partenaire actif | Multi-partenaires |
| Scope | Agri only F1–F6 | Idem + ops | + API Enterprise | + B2B outils (pas social) |

---

## I. Documents liés (source de vérité)

| Doc | Rôle |
|-----|------|
| `docs/decision-strategique-pricing-gwa-2026-07-28.md` | Grille revenus DG |
| `docs/abonnements-services-alignes-2026-07-28.md` | Abo = services code |
| `docs/politique-cooperatives-types-compte.md` | Coops + lock type |
| `docs/avis-cinetpay-vs-feexpay-2026-07-28.md` | Paiement / séquestre |
| `docs/positionnement-partenaires-bancaires.md` | Banques |
| `docs/scope-beta.md` | Hors scope |
| `docs/architecture.md` | Front / back |
| `docs/audit-complet-2026-07-28.md` | Snapshot audit (à resynchroniser post-FeexPay) |
| `lib/pricing/entitlements.ts` | Entitlements runtime |

---

## J. Glossaire court

| Terme | Définition |
|-------|------------|
| **Escrow applicatif** | GWA décide du moment de payout ; fonds transitent via compte marchand agrégateur |
| **SCG** | Score de Confiance GWA |
| **Yelly** | Assistant IA (Gemini) |
| **GMV** | Volume brut de transactions marketplace |
| **Entitlement** | Droit produit lié au palier d’abonnement |

---

*Document maintenu avec le code. Toute promesse commerciale doit tracer une ligne dans §C / §G et un entitlement ou ticket roadmap.*
