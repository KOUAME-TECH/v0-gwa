# GWA — Outils & logiciels nécessaires

**Date :** 24 juil. 2026 · **Prod :** https://v0-gwa-mu.vercel.app  
**Objet :** inventaire des outils / services pour **faire tourner** GWA et pour **tenir la charge**.

---

## 1. Socle obligatoire (fonctionnement)

| Outil / logiciel | Rôle | Critique |
|------------------|------|----------|
| **Node.js 20+ / 24** | Runtime build & serveur Next | Oui |
| **npm** | Dépendances (`package-lock.json`) | Oui |
| **Next.js 16 + React 19** | Application web / PWA | Oui |
| **TypeScript** | Code typé | Oui |
| **Tailwind CSS 4** | UI | Oui |
| **Vercel** | Hosting, CDN, serverless, Analytics, région `cdg1` | Oui |
| **Git + GitHub** | Code, CI deploy, PR | Oui |
| **Supabase** | Auth, Postgres, Storage, Realtime, RLS | Oui |
| **PostgreSQL** (via Supabase) | Données métier | Oui |
| **pg_cron** (extension Supabase) | Digest Harmattan quotidien | Oui |

Sans ce socle, GWA ne démarre pas correctement.

---

## 2. Services partenaires (fonctionnalités métier)

| Service | Usage GWA | Obligatoire go-live |
|---------|-----------|---------------------|
| **FeexPay** | Paiement + escrow (checkout + webhook HMAC) | **Oui** (encore à finaliser live) |
| **Twilio** et/ou **Africa’s Talking** et/ou **Termii** | SMS OTP login | **Oui** (au moins 1 crédité) |
| **OneSignal** | Push web (PWA) | Fortement recommandé |
| **AgentMail** | E-mails Support / Contact | Oui (inbox support) |
| **Upstash Redis** (ou Vercel KV) | Rate-limit + store OTP | Oui en prod |
| **Open-Meteo** | Météo (widget agriculture) | Souhaitable (fallback dégradé OK) |
| **Nominatim (OSM)** | Géocodage / reverse GPS | Souhaitable |
| **WhatsApp Business** (lien wa.me) | Support humain | Opérationnel (pas API obligatoire en bêta) |

### Secrets / comptes à provisionner (Vercel + dashboards)

- Supabase : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auth OTP : `OTP_PEPPER` + clés SMS (Twilio / AT / Termii)
- Redis : `UPSTASH_REDIS_REST_URL` + `TOKEN` (ou `KV_REST_API_*`)
- Paiement : `FEEXPAY_API_KEY`, `FEEXPAY_SHOP_ID`, `FEEXPAY_WEBHOOK_SECRET`
- Push : `ONESIGNAL_APP_ID` / `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- Mail : `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `CONTACT_INBOX_TO`
- Cron secours : `CRON_SECRET`, éventuellement `DIGEST_INTERNAL_KEY`

---

## 3. Stack applicative (déjà dans le repo)

| Couche | Choix |
|--------|--------|
| UI | React 19, Radix UI, Lucide, Sonner, Embla, Recharts |
| Forms | React Hook Form + Zod |
| Data client | Supabase JS / SSR, SWR |
| PWA | Service Worker (`/sw.js`), Web Manifest, OneSignal Web SDK |
| Tests | Vitest |
| Qualité | ESLint, TypeScript |

---

## 4. Outils d’équipe (dev / ops / produit)

| Outil | Usage |
|-------|--------|
| **Cursor / VS Code** | Développement |
| **GitHub** | Repo, PR, reviews |
| **Supabase Dashboard** | SQL, Auth, Storage, logs, pg_cron |
| **Vercel Dashboard** | Deploys, env, logs, domaines |
| **OneSignal Dashboard** | Audiences, origines web, delivery |
| **FeexPay Back-office marchand** | Paiements, webhooks, reconcil |
| **Twilio / AT / Termii consoles** | Crédits SMS, sender ID, logs |
| **AgentMail** | Inbox contact |
| **Notion** | Docs produit / audit (optionnel) |
| **Playwright / Chrome DevTools** | QA responsive / PWA / offline |
| **Postman / curl / gh CLI** | Smoke API & ops |

---

## 5. Montée en charge (scale) — à prévoir

### Déjà en place (base scale)
- Hosting **serverless Vercel** (auto-scale HTTP)
- **CDN** Vercel pour assets
- **Postgres Supabase** + RLS
- **Realtime** Supabase (chat / notifs)
- **Redis Upstash** (rate-limit OTP / abuse)
- Région EU **Paris (`cdg1`)** — latence Afrique de l’Ouest acceptable en bêta

### À renforcer quand le trafic monte

| Domaine | Action recommandée | Outil / produit typique |
|---------|--------------------|-------------------------|
| **Base de données** | Plan Supabase Pro/Team, connection pooling, indexes, read replicas si besoin | Supabase Pro+, PgBouncer |
| **Stockage médias** | CDN images, compression, quotas Storage | Supabase Storage + Vercel Image Optimization / Cloudflare Images |
| **SMS** | Dual-provider + budget alertes + sender IDs multi-pays | Twilio + Africa’s Talking |
| **Paiements** | FeexPay prod + monitoring webhooks + reconcil | FeexPay + exports CSV / BI |
| **Push** | Segments, quiet hours, rate sending | OneSignal |
| **Observabilité** | Erreurs, perf, uptime | **Sentry**, Vercel Observability, Better Stack / Checkly |
| **Analytics produit** | Funnel OTP → 1ʳᵉ commande | Vercel Analytics, PostHog ou Plausible |
| **Cache / edge** | Cache catalogue, rate-limit global | Upstash Redis, Vercel Edge Config |
| **Files / jobs** | Digest, relances KYC, rappels escrow | pg_cron + (plus tard) Inngest / Trigger.dev / Queue |
| **Sécurité** | WAF, bot protection, HIBP, secrets rotation | Vercel Firewall / Cloudflare, Supabase Auth |
| **DNS / domaine custom** | `gwa.ci` (ou équivalent) + TLS | Registrar + Vercel Domains |
| **Mobile natif (post-bêta)** | App stores | Expo / React Native (roadmap docs) |
| **SCG v2** | Moteur scoring avancé | FastAPI / service dédié (contrat doc SCG) |

### Ordres de grandeur (indicatif)

| Phase | Utilisateurs | Priorité ops |
|-------|--------------|--------------|
| Bêta | dizaines → centaines | SMS + FeexPay + OneSignal stables |
| Traction | milliers | Monitoring, pool DB, CDN médias, dual SMS |
| Scale | dizaines de milliers | Replicas / queues, WAF, analytics, SLA support |

---

## 6. Poste développeur (minimum)

- macOS / Linux / Windows WSL
- Node.js LTS, Git, navigateur Chromium
- Compte GitHub + accès Vercel + Supabase projet **GWA-DATABASE**
- Accès (lecture) aux dashboards SMS / FeexPay / OneSignal / AgentMail

---

## 7. Synthèse « must-have » vs « scale »

**Pour que GWA fonctionne aujourd’hui :**  
Vercel · Supabase (Postgres/Auth/Storage/Realtime) · Redis Upstash · SMS (1 provider) · FeexPay · AgentMail · OneSignal · Node/Next.

**Pour monter en charge sereinement :**  
Plans payants Supabase/Vercel · observabilité (Sentry) · dual SMS · CDN médias · queues/jobs · WAF · analytics produit · domaine custom · runbooks ops.

---

*KOUAME CORPORATION — GWA · Inventaire outils · 24 juil. 2026*
