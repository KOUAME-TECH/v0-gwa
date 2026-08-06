# GWA OS — Source de vérité unique

> Système Notion (modèle Shizu) exécuté pour **GWA**.  
> **Notion MCP non authentifié** dans cet environnement cloud → structure complète en markdown, à coller page par page dans Notion.  
> Une fois Notion connecté dans Cursor Desktop, on pourra synchroniser automatiquement.

---

## Comment coller dans Notion (15 min)

1. Crée une page racine **`GWA OS`** dans ton teamspace.
2. Crée les pages enfants dans l’ordre de ce dossier (voir sommaire).
3. Copie-colle le contenu de chaque `.md` dans la page Notion correspondante.
4. Transforme les tableaux markdown en databases Notion si tu veux (Décisions, État du build).
5. **Hors de l’OS** (racine teamspace, pas enfant de GWA OS) : page `Espace Investisseurs`.

## Rituel non négociable

En **fin de chaque session** significative : mettre à jour le **Dashboard** (Pulse + À faire + Build log).  
Sans ce geste, l’OS meurt en 3 semaines.

## Sommaire des fichiers

| Fichier Notion | Fichier repo |
|----------------|--------------|
| 🏠 GWA OS (racine) | [`00-racine.md`](./00-racine.md) |
| ⚡ Dashboard | [`01-dashboard.md`](./01-dashboard.md) |
| 🏠 Product | [`domaines/10-product.md`](./domaines/10-product.md) |
| 🌾 Producteurs & Coops | [`domaines/20-producteurs-coops.md`](./domaines/20-producteurs-coops.md) |
| 📦 Commandes & Escrow | [`domaines/30-commandes-escrow.md`](./domaines/30-commandes-escrow.md) |
| ⚙️ Admin & Ops | [`domaines/40-admin-ops.md`](./domaines/40-admin-ops.md) |
| 🧱 Tech | [`domaines/50-tech.md`](./domaines/50-tech.md) |
| ⚖️ Legal & Société | [`domaines/60-legal-societe.md`](./domaines/60-legal-societe.md) |
| ✅ Registre des décisions | [`70-registre-decisions.md`](./70-registre-decisions.md) |
| 📦 Archives | [`archives/80-archives.md`](./archives/80-archives.md) |
| 💼 Espace Investisseurs (HORS OS) | [`hors-os-espace-investisseurs.md`](./hors-os-espace-investisseurs.md) |

## Contexte projet (rempli)

| | |
|--|--|
| **Nom** | GWA |
| **Activité** | Marketplace agricole + finance de confiance (escrow applicatif, SCG) en Côte d’Ivoire |
| **Stade** | Pré-lancement / soft-launch technique (PWA live) |
| **Qui** | Yao Kouamé (DG / fondateur) · agents Cursor (build) |
| **Prod** | https://v0-gwa-mu.vercel.app |
| **Repo** | https://github.com/MYSTERE-arch/v0-gwa |
| **Ce qui fait perdre du temps** | Ops secrets (FeexPay, SMS) + savoir « où on en est » entre sessions |
