# Propositions — vague 4 : accessibilité & facilité d’usage

**Date :** 31 juillet 2026  
**Statut v2/v3 :** **VALIDÉES**  
**Focus :** accessibilité (WCAG-ish mobile) + simplicité pour **tous** (illettrisme partiel, 3G, grands doigts, vision basse, clavier).  
**Sans toi :** 100 % code / copy / CSS — pas d’ops.

---

## Principes produit

1. **Une action claire** par écran (pas de jargon).  
2. **Cibles tactiles ≥ 44×44 px**.  
3. **Contraste** texte ≥ 4.5:1 sur fond crème/vert.  
4. **Clavier + lecteur d’écran** : labels, skip link, focus visible, Escape ferme.  
5. **Moins de lecture** : icône + 3–5 mots, suggestions Yelly par rôle.  
6. **Grand texte** + **réduire les animations** (préférence utilisateur / OS).

---

## A. Accessibilité technique (agent)

| # | Proposition |
|---|-------------|
| **A1** | Skip link « Aller au contenu » + `id="main-content"` |
| **A2** | `prefers-reduced-motion` global (stop dots, slide, fade) |
| **A3** | Préférence « Moins d’animations » dans Profil (localStorage) |
| **A4** | Focus trap + Escape sur panneau Yelly |
| **A5** | `aria-label` sur tous les icon-only (retour, recherche, panier flottant) |
| **A6** | Labels visibles `htmlFor` sur auth signup ville/pays + publier |
| **A7** | Dialog close FR (« Fermer ») |
| **A8** | Bouton `icon` min 44px |
| **A9** | Offline banner contraste + liens plus gros |
| **A10** | Bottom nav labels `#6B7280` (meilleur contraste) |
| **A11** | `role="status"` typing Yelly + live regions toasts |
| **A12** | Hit area 44px chips suggestions Yelly / offline |
| **A13** | Admin menu mobile : `aria-label` Menu/Fermer |
| **A14** | Landmarks : `nav`, `main`, `complementary` cohérents |
| **A15** | Contraste badges amber sur crème vérifié |
| **A16** | Mode haut contraste optionnel (`gwa-high-contrast`) |
| **A17** | Respect `prefers-contrast: more` |
| **A18** | Erreurs formulaire liées `aria-describedby` |
| **A19** | Images produit : `alt` = nom produit (pas vide) |
| **A20** | Vidéo/TTS : pause si reduced-motion |

---

## B. Facilité d’usage (tous niveaux)

| # | Proposition |
|---|-------------|
| **U1** | Boutons primaires toujours verbe d’action (« Publier », « Confirmer ») |
| **U2** | Aide contextuelle 1 ligne sous champs prix/stock |
| **U3** | Confirmation réception : gros bouton vert pleine largeur |
| **U4** | Pictogrammes statut commande (pas seulement texte) |
| **U5** | Mode « texte simple » : phrases ≤ 8 mots sur empty states |
| **U6** | Wizard publish : 1 champ / étape optionnel (toggle) |
| **U7** | Recherche commandes avec label visible « Chercher » |
| **U8** | Feedback haptique léger `navigator.vibrate(10)` après succès (si dispo) |
| **U9** | Évite les gestes seuls : toujours bouton alternatif |
| **U10** | Numéros de téléphone cliquables `tel:` partout |
| **U11** | Montants toujours formatés FR + « FCFA » |
| **U12** | Dates relatives (« il y a 2 h ») + absolu au long-press / title |
| **U13** | Onboarding 3 écrans illustrés (acheter / vendre / coop) |
| **U14** | Page Aide `/aide` : FAQ courte + Yelly + WhatsApp |
| **U15** | Glossaire 10 mots (séquestre, SCG, Digest) lié depuis Yelly |
| **U16** | Désactiver auto-zoom iOS : `font-size: 16px` déjà — vérifier inputs |
| **U17** | Sticky CTA bas d’écran sur publish / confirm |
| **U18** | « Annuler » toujours à gauche, primaire à droite |
| **U19** | Empty states : 1 phrase + 1 bouton (règle stricte) |
| **U20** | Checklist accessibilité dans `docs/a11y-checklist.md` pour PR |

---

## C. Lecteurs d’écran & clavier

| # | Proposition |
|---|-------------|
| **SR1** | Annoncer changement d’onglet bottom nav (`aria-live`) |
| **SR2** | Fil Yelly : `aria-relevant="additions"` sur liste messages |
| **SR3** | Tables admin : `<caption>` ou `aria-label` |
| **SR4** | Ordre de tabulation logique dashboards (CTA avant listes) |
| **SR5** | Raccourci `?` → ouvrir Yelly (desktop) |

---

## D. Inclusive design (terrain CI)

| # | Proposition |
|---|-------------|
| **I1** | Mode data-saver = moins d’images (déjà proposé) + texte prioritaire |
| **I2** | Audio : boutons Digest / Yelly TTS plus visibles |
| **I3** | Couleurs jamais seules : icône + texte pour statut |
| **I4** | Éviter le violet / glow (marque GWA) — contrastes verts/crème |
| **I5** | Support langues locales plus tard — FR simple d’abord (pas de franglais) |

---

## E. Ordre d’implémentation agent

**Sprint Acc-1 (cette livraison)**  
A1–A12 · U7 · U19 partiel  

**Sprint Acc-2**  
A13–A20 · U1–U6 · U13–U15 · SR1–SR2  

**Sprint Acc-3**  
U8–U12 · U14 Aide · SR3–SR5 · checklist docs  

---

## F. Hors scope (besoin de toi)

- Tests utilisateurs terrain réels  
- Traduction baoulé / dioula (contenu)  
- Audit WCAG externe payant  

---

*Index : `docs/README.md` · Suite de v2/v3 autonomes.*
