# Ops — Back-office Support sans code

Guide opérationnel pour que l'équipe **Support GWA** (Abidjan / WhatsApp) gère le back-office
**sans intervention développeur**, après le bootstrap initial du fondateur.

## Sécurité DB (migrations trackées)

Toute correction RLS / Storage / RPC doit être un fichier sous `scripts/schema/`
(ex. `035_security_hardening_storage_rpc_audit.sql`), appliqué via migration Supabase
(MCP `apply_migration` ou CLI), **jamais uniquement dans l'UI**.

### Auth — protection mots de passe compromis (manuel console)

1. Supabase Dashboard → projet GWA → **Authentication** → **Providers** → **Email**
   (ou **Password security** / **Password Protection** selon l'UI).
2. Activer **Leaked password protection** (HaveIBeenPwned) — **Pro plan+**.
3. Message app déjà mappé : `lib/auth/auth-errors.ts`
   (« Ce mot de passe a déjà été compromis… »).

---

## Principe

| Étape | Qui | Outil | Fréquence |
|-------|-----|-------|-----------|
| Bootstrap fondateur | Fondateur / CTO | Supabase SQL Editor (une fois) | Une seule fois |
| Gestion quotidienne | Super admin + Support | Login + UI `/admin` | Quotidien |
| Promotion Support | Super admin uniquement | `/admin/users` | À la demande |

**Après le premier `super_admin`, plus aucun SQL n'est nécessaire** pour ajouter ou retirer
des accès Support.

---

## 1. Bootstrap — créer le premier super administrateur (une fois)

> Incontournable : aucun compte ne peut s'auto-promouvoir sans admin existant.

### Prérequis

1. Créer un compte sur la plateforme : `/auth/signup` (email + profil).
2. Se connecter au moins une fois pour que le profil existe dans `profiles`.

### Option A — SQL Editor Supabase (recommandé)

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard) → projet GWA → **SQL Editor**.
2. Récupérer l'UUID utilisateur :

```sql
SELECT id, email, full_name
FROM public.profiles
WHERE email = 'fondateur@example.com';
```

3. Insérer le rôle (remplacer `VOTRE_USER_ID`) :

```sql
INSERT INTO public.admin_roles (user_id, role, permissions, is_active)
VALUES (
  'VOTRE_USER_ID',
  'super_admin',
  '{"all": true}'::jsonb,
  true
)
ON CONFLICT (user_id) DO UPDATE
SET role = 'super_admin', is_active = true, updated_at = NOW();
```

4. Vérifier :

```sql
SELECT p.email, ar.role, ar.is_active
FROM public.admin_roles ar
JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.is_active = true;
```

Scripts de référence dans le repo :

- `scripts/ops/005_create_first_admin.sql` — fonction `promote_to_admin` (service_role only)
- `scripts/ops/018_setup_admin.sql` — promote le premier utilisateur inscrit

### Option B — premier utilisateur automatique (dev / démo)

Exécuter `scripts/ops/018_setup_admin.sql` dans le SQL Editor si le fondateur est bien le
**premier compte** créé sur l'environnement.

### Compte fondateur promu (2026-07-19)

| Email | Rôle | Notes |
|-------|------|-------|
| `kouamecorporation@gmail.com` | `super_admin` | Promu via Supabase MCP (projet `frorfexbcyfbydkiwxqv`). Téléphone non lié — connexion **Email** uniquement pour l'instant ; lier `+2250502153627` plus tard dans **Profil**. |

---

## 2. Donner accès Support — sans code (super admin)

1. Se connecter en **super administrateur**.
2. Aller sur **`/admin/users`**.
3. Rechercher le collaborateur (email ou téléphone lié au profil).
4. Menu **Actions** (⋯) → **Donner accès Support**.
5. Le collaborateur se déconnecte/reconnecte → sidebar filtrée selon son rôle.

Actions disponibles pour le super admin :

| Action UI | Effet |
|-----------|-------|
| **Donner accès Support** | Rôle `support` — KYC, litiges, signalements, commandes (lecture), file affacturage |
| **Donner accès Admin** | Rôle `admin` — accès élargi (SCG, finances, paramètres) sans promotion de rôles |
| **Révoquer** | Désactive l'accès back-office (`is_active = false`) |

**Interdictions de sécurité (appliquées côté API) :**

- Impossible de se promouvoir soi-même.
- Impossible de créer un `super_admin` via l'interface.
- Impossible de révoquer un `super_admin` via l'interface.

---

## 3. Parcours Support — connexion et sections autorisées

### Connexion

1. URL : **`/auth/login`** (SMS OTP ou email selon config prod — voir `docs/ops-auth.md`).
2. Après login, accès direct : **`/admin`** (redirection automatique si rôle actif).

### Sections visibles (rôle `support`)

| Section | URL | Usage Support |
|---------|-----|---------------|
| Dashboard | `/admin` | Vue d'ensemble |
| Utilisateurs | `/admin/users` | Recherche, vérification, suspension |
| Commandes | `/admin/orders` | Consultation litiges / suivi |
| Signalements | `/admin/reports` | Modération contenu |
| Litiges | `/admin/disputes` | Médiation acheteur / vendeur |
| Vérifications | `/admin/verifications` | KYC / documents |
| Affacturage | `/admin/factoring` | File d'attente — approuver / refuser (pas de décaissement) |

### Sections masquées pour Support

- **SCG Config** (`/admin/scg`)
- **Finances** (`/admin/finances`)
- **Paramètres** (`/admin/settings`)
- **Promotion d'accès admin** (réservée super admin)

---

## 4. SOP Support — contexte Abidjan / WhatsApp

Canal principal utilisateurs : **WhatsApp** (+225). Le back-office complète le canal vocal.

### Vérification KYC (`/admin/verifications`)

1. Demande reçue sur WhatsApp → retrouver l'utilisateur par **téléphone E.164** (`+225…`) dans
   `/admin/users`.
2. Ouvrir la demande dans **Vérifications** → vérifier pièces (CNI, coopérative, etc.).
3. **Approuver** ou **Refuser** avec une note en français claire (visible notification in-app).
4. Si refus : indiquer au producteur sur WhatsApp les documents manquants.

### Litige commande (`/admin/disputes`)

1. Identifier la commande (numéro ou email acheteur).
2. Consulter preuves + historique dans **Litiges**.
3. Statut + résolution documentée avant message WhatsApp de clôture.

### Suspension compte (`/admin/users`)

1. Toujours renseigner une **raison** (fraude, contenu illicite, arnaque récurrente).
2. Informer l'utilisateur par WhatsApp avec le numéro support officiel (`platform_settings`).
3. Réactivation via **Réactiver** après régularisation.

### Affacturage (`/admin/factoring`)

- Support : **Approuver / Refuser** uniquement.
- **Décaissement** (`Marquer décaissée`) : réservé admin / super admin (validation finance).

---

## 5. Rôles existants

| Rôle DB | Label UI | Périmètre |
|---------|----------|-----------|
| `super_admin` | Super administrateur | Tout + promotion / révocation rôles |
| `admin` | Administrateur | Back-office complet sauf gestion des rôles |
| `support` | Support | Opérations client (KYC, litiges, signalements, users) |
| `moderator` | Modérateur | Produits + signalements (optionnel) |

Matrice technique : `lib/auth/admin-permissions.ts`.

---

## 6. URLs par environnement

| Environnement | Back-office | Login |
|---------------|-------------|-------|
| **Local** | `http://localhost:3000/admin` | `http://localhost:3000/auth/login` |
| **Preview Vercel** | `https://<branch>-<project>.vercel.app/admin` | même domaine + `/auth/login` |
| **Production** | `https://<domaine-prod>/admin` | même domaine + `/auth/login` |

> Preview et prod partagent le **même projet Supabase** si les variables `NEXT_PUBLIC_SUPABASE_*`
> sont identiques. Un super admin créé en prod accède aussi au back-office preview (et inversement).
> Pour isoler, utiliser un projet Supabase séparé sur les previews.

Variables serveur requises (Vercel) : `SUPABASE_SERVICE_ROLE_KEY` pour les API admin
(`/api/admin/*`).

---

## 7. Dépannage rapide

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Redirection `/dashboard` après login | Pas de ligne `admin_roles` active | Super admin : promouvoir via UI ou SQL bootstrap |
| Menu incomplet | Rôle `support` (normal) | Super admin si besoin d'accès SCG / finances |
| « Accès refusé » sur action | Permission rôle | Vérifier rôle dans sidebar (badge sous le nom) |
| « Super administrateur requis » | Action promotion rôle | Se connecter avec compte `super_admin` |

---

## 8. Ce qui reste côté développeur

- **Premier** `super_admin` si aucun n'existe (SQL Editor, une fois).
- Évolution schéma / nouvelles sections back-office.
- Rotation `SUPABASE_SERVICE_ROLE_KEY` / secrets Vercel.

Tout le reste (Support, suspensions, KYC, litiges, promotion Support) = **UI uniquement**.
