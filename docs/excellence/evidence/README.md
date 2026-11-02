# Evidence — audit excellence GWA

Organisation :

- `acheteur/{320,768,1024}/` — marketplace, panier, buyer-gate
- `producteur/{320,768,1024}/` — farmer-gate, publier-gate
- `cooperative/{320,768,1024}/` — coop-dashboard-gate
- `abonnement/{320,768,1024}/` — page abonnement
- `backoffice/{320,768,1024}/` — admin-gate
- `branding/` — logos header 320/1024, dark mode, PO watermark, favicons meta
- `rate-limit/` — burst prod (FAIL), burst local (PASS 429@11), health Redis
- `redteam/` — SQLi / XSS / BOLA / CSRF / upload MIME
- Flat `*-{320,768,1024}.png` conservés pour compat

Source : Playwright Chromium contre `http://127.0.0.1:3010` (branche PR #27) + probes curl prod `mygwa.org`.
