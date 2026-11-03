# Baseline reset — 45/100 (2026-11-02)

Les scores 91–100 / GO 95–97 documentés précédemment sont **INVALIDÉS**.

## Pourquoi

1. Données test/junk encore visibles en prod (« comment vendre mieux », marketing démo)
2. SEO incomplet : `/robots.txt` et `/sitemap.xml` → **404** ; titres génériques ; pages sans H1 AT-accessible
3. Gaps humains non fermés (HIBP, PITR physique, GeniusPay non configuré)
4. Preuves antérieures mélangeaient tests locaux / déploiements partiels

## Score de départ (ruthless)

| Domaine | Score | Justification |
| --- | ---: | --- |
| Global | **45** | Moyenne pondérée réaliste |
| UI/UX | 52 | Chat riche mais H1/aria-hidden chrome, nested main |
| Frontend | 50 | Client-only pages, metadata faible |
| Backend | 58 | Redis RL PASS prod ; RLS OK ; indexes morts INFO |
| Audio | 48 | DSP/STT code présent ; preuves E2E auth limitées |
| Négociation | 55 | Offre→PO/QR code ; pas d’E2E auth |
| Sécurité | 62 | CSRF/RL/PII OK ; HIBP WARN |
| SEO | **28** | robots/sitemap 404 ; titles plats |
| IA | 55 | Gouvernance doc + adversarial unit ; ISO 42001 partiel |
| Continuité | 40 | Docs RTO/RPO ; PITR non vérifié |

GeniusPay/FeexPay **FROZEN**. Redis `KV_REST_*` **à conserver**.
