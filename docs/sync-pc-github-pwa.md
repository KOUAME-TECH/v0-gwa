# Sync Cloud → PC → GitHub → PWA téléphone

Objectif : le code cloud Cursor, le dépôt GitHub et l’app installée sur téléphone sont **la même version**.

## 1. GitHub (déjà poussé)

- Branche agent : `cursor/cloud-agent-1784519810125-lmf8f`
- PR : https://github.com/MYSTERE-arch/v0-gwa/pull/3
- Après merge → `main` : Vercel redéploie la prod

Repo : `https://github.com/MYSTERE-arch/v0-gwa`

## 2. PC (récupérer le code)

Dans le dossier local du projet :

```bash
cd "chemin/vers/gwa-platform-prototype"
git fetch origin
git checkout main
git pull origin main
npm install
npm run dev
```

Si tu travailles encore sur la branche agent avant merge :

```bash
git fetch origin
git checkout cursor/cloud-agent-1784519810125-lmf8f
git pull origin cursor/cloud-agent-1784519810125-lmf8f
```

## 3. PWA sur téléphone (Android prioritaire)

URL prod : **https://v0-gwa-mu.vercel.app**

### Android (Chrome)

1. Ouvre https://v0-gwa-mu.vercel.app (Wi‑Fi conseillé la 1ère fois)
2. Menu ⋮ → **Installer l’application** / **Ajouter à l’écran d’accueil**
   - ou va sur https://v0-gwa-mu.vercel.app/download et appuie sur Installer
3. Icône **GWA** apparaît sur l’écran d’accueil

### iPhone (Safari)

1. Ouvre l’URL dans **Safari**
2. Bouton Partager → **Sur l’écran d’accueil**
3. Ajouter

### Après un déploiement

- Ferme complètement la PWA
- Rouvre depuis l’icône (ou vide le cache Chrome pour le site) pour charger la nouvelle version (`sw.js` cache `gwa-v2`)

## 4. Checklist « tout est aligné »

| Surface | Comment vérifier |
|---------|------------------|
| Cloud Cursor | Commit `40c4d7d`+ sur la branche agent |
| GitHub `main` | Commit de merge visible sur le repo |
| Vercel prod | Déploiement Ready sur `v0-gwa-mu.vercel.app` |
| PC | `git pull` + `npm run dev` sans erreur |
| Téléphone | PWA installée + page `/download` OK |

## 5. Ne pas confondre

- **Preview Vercel** (branche PR) ≠ **prod** (main) — pour le téléphone, toujours installer depuis la **prod** après merge.
- Les secrets (`.env.local`) restent sur PC / Vercel Dashboard — **jamais** commités.
