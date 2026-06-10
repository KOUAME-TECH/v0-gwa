# GWA Platform - Demo Investisseur

## Acces Rapide

### Backoffice Admin
- **URL**: `/admin`
- **Compte Admin**: kouayao312@gmail.com
- **Modules**: 13 modules (Dashboard, Utilisateurs, Produits, Commandes, Cooperatives, Formations, Signalements, Litiges, Verifications, SCG Config, Finances, Statistiques, Parametres)

### App Mobile (PWA)
- **URL**: `/download`
- Installable sur Android, iOS et Desktop
- Fonctionne hors-ligne

## Pages Cles a Presenter

1. **Feed Social** `/` - Fil d'actualite mixte (produits + publications)
2. **Marketplace** `/marketplace` - Catalogue produits avec 3 modes d'affichage
3. **Communaute** `/communaute` - Reseau social agriculteurs/artisans
4. **Formations** `/formations` - Academy GWA
5. **Messages** `/messages` - Chat en temps reel
6. **B2B** `/b2b` - Demandes de devis professionnelles
7. **Dashboard Producteur** `/dashboard/farmer` - Espace vendeur

## Comptes de Test

### Creer un compte producteur:
1. Aller sur `/auth/signup`
2. Choisir "Producteur" 
3. Remplir le formulaire
4. Confirmer l'email

### Creer un compte acheteur:
1. Aller sur `/auth/signup`
2. Choisir "Acheteur"
3. Remplir le formulaire

## Donnees Demo

- 6 produits demo (cacao, cafe, noix de cajou, mangues, panier, bogolan)
- 3 publications demo
- 5 categories

## Architecture

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Paiements**: Stripe + Mobile Money (Orange, MTN, Wave)
- **60+ pages** organises en modules

## Points Forts a Souligner

1. **Africa-First**: Design adapte aux contraintes terrain (3G, Android, pictogrammes)
2. **SCG Score**: Systeme de scoring gamifie pour la durabilite
3. **Multi-plateforme**: PWA + Web responsive
4. **B2B + B2C**: Marketplace mixte
5. **Cooperatives**: Gestion complete des cooperatives agricoles
6. **Formation**: Academy integree
