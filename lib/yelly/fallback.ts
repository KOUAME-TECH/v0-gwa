/**
 * Fallback mots-clés Yelly — déterministe, chiffres alignés fiche métier.
 * Pas de server-only : utilisable en tests unitaires.
 */
import { getYellyDomainFacts } from "@/lib/yelly/knowledge"

export function keywordFallback(message: string, page?: string): string {
  const m = message.toLowerCase()
  const facts = getYellyDomainFacts()

  if (/bonjour|salut|bonsoir|hey|hello|hi\b/.test(m)) {
    return "Bonjour, je suis Yelly, l’assistante GWA. Je peux t’aider sur l’argent protégé, le panier, le portefeuille, le score de confiance, la coopérative, les abonnements et FeexPay. Que veux-tu savoir ?"
  }
  if (/digest|harmattan|écouter|parcours|notif|nouveautés/.test(m)) {
    return "Les nouveautés : Marché → Écouter / notifications. Produits près de toi, à écouter. Push = OneSignal ; SMS OTP = Africa’s Talking."
  }
  if (/escrow|s[eé]questre|argent\s*prot[eé]g|s[eé]curis/.test(m)) {
    return (
      "Sur GWA, l’argent du panier est protégé jusqu’à ta confirmation de réception. " +
      "Sans confirmation, libération auto après le délai paramétré (défaut 7 jours). " +
      "Le vendeur voit le montant en attente tant que l’argent n’est pas libéré. " +
      "Les retraits portefeuille ne portent que sur des fonds déjà libérés."
    )
  }
  if (/portefeuille|wallet|retrait|retirer|solde|o[uù]\s*est\s*mon\s*argent/.test(m)) {
    return (
      "Portefeuille vendeur : solde disponible vs argent gardé (en cours de livraison). " +
      `Retrait min. ${facts.walletMinWithdrawalFcfa.toLocaleString("fr-FR")} FCFA (réglable admin). ` +
      "Seuls les fonds déjà libérés sont retirables — via FeexPay ou la file finances."
    )
  }
  if (/feexpay|mobile\s*money|orange\s*money|mtn|wave|moov/.test(m)) {
    return (
      "Paiements panier via FeexPay (Mobile Money / carte). " +
      "Après paiement, suis la confirmation ; le webhook FeexPay valide côté serveur. " +
      "Vérifie aussi Mes commandes si le statut tarde."
    )
  }
  if (/panier|checkout|acheter|marketplace|boutique|marché/.test(m)) {
    return (
      "Panier GWA = produits du même vendeur. Checkout → FeexPay → argent protégé. " +
      "Ensuite : Mes commandes → confirmation réception → avis (optionnel)."
    )
  }
  if (/publier|offre|vendre|produit/.test(m) && !/commission|abo/.test(m)) {
    return `Pour vendre : Publier → nom, prix, photos, ville. Gratuit : max ${facts.freeMaxListings} annonces actives.`
  }
  if (/\bscg\b|score|confiance|bancable|fiabilit|notation|avis/.test(m)) {
    return (
      `Score de confiance : 0–${facts.scgMax}, seuil avance sur vente ${facts.scgTrustThreshold}+. ` +
      "Monte avec profil complet, livraisons honorées, avis 1–5 liés à commande. " +
      "Commentaires sans note n’entrent pas dans le score. " +
      `Avance sur vente : score ≥ ${facts.factoringMinScg} + dossier validé.`
    )
  }
  if (/commission|frais|tarif|prix\s*abo|abonnement|starter|pro\b|palier/.test(m)) {
    return (
      `Commissions vendeur : Gratuit ${facts.commissionFreePct}, Starter ${facts.commissionStarterPct}, Pro ${facts.commissionProPct}. ` +
      `Abo : Starter ${facts.starterMonthlyFcfa.toLocaleString("fr-FR")} FCFA/mois, Pro ${facts.proMonthlyFcfa.toLocaleString("fr-FR")} FCFA/mois (Entreprise = devis). ` +
      "Activation via l’app puis validation ops. Voir /abonnement."
    )
  }
  if (/factoring|affacturage|avance|financement/.test(m)) {
    return (
      `Avance sur vente GWA : producteurs/coop avec score ≥ ${facts.factoringMinScg}, dossier examiné par l’équipe. ` +
      "Ce n’est pas un crédit bancaire automatique — versement hors plateforme après validation."
    )
  }
  if (/coop|coop[eé]rative|15\s*membres|adh[eé]sion/.test(m)) {
    return (
      `Qualification coop : ≥ ${facts.coopMinMembers} membres actifs (fenêtre ${facts.coopPaymentDeadlineDays} j) ` +
      `+ docs légaux sous ${facts.coopEngagementMonths} mois. Sinon usage basique OK, avancé restreint.`
    )
  }
  if (/kyc|v[eé]rif|identit|badge|document/.test(m)) {
    return "Vérification : Profil → Vérification. Photo nette de ta pièce. Requis pour certains droits vendeur et l’avance sur vente."
  }
  if (/livraison|livrer|confirm|commande/.test(m)) {
    return (
      "Après paiement : Mes commandes. À réception, confirme pour libérer l’argent protégé au vendeur. " +
      "Sans confirmation, libération auto possible après le délai configuré."
    )
  }
  if (/signal|litige|plainte|arnaque|fraude/.test(m)) {
    return (
      "Signaler un contenu depuis le fil. Litige commande : décris le cas clairement — l’équipe GWA traite. " +
      "Jamais de code OTP ni mot de passe dans le chat."
    )
  }
  if (/otp|sms|connexion|se\s*connecter/.test(m)) {
    return "Connexion : numéro CI (+225) + code OTP SMS. GWA ne te demandera jamais ton OTP ici."
  }
  if (/whatsapp|contact|aide|humain|support|quelqu.?un|parler\s*[aà]/.test(m)) {
    return `Pour parler à quelqu’un : bouton escalade (compte connecté) ou WhatsApp ${facts.supportWhatsapp}.`
  }
  if (/gwa|kouam[eé]|c.?est\s*quoi|qui\s*[eê]tes/.test(m)) {
    return (
      "GWA (Green West Africa) : marketplace agri Côte d’Ivoire — argent protégé, score de confiance, portefeuille, coop. " +
      "Business Unit de KOUAME Corporation, pas une banque."
    )
  }
  if (/yelly|qui\s*es[- ]tu|assistante/.test(m)) {
    return (
      "Je suis Yelly, assistante GWA. Je m’appuie sur les règles produit (argent protégé, score, abo, coop, FeexPay). " +
      `Cas complexe : « Parler à quelqu’un » ou WhatsApp ${facts.supportWhatsapp}.`
    )
  }
  if (page?.includes("profil")) {
    return "Sur Profil : photo, bio, lieux. Type de compte : contacte le support pour le changer."
  }
  return (
    "Précise ton besoin : argent protégé, panier/FeexPay, portefeuille, score de confiance, abonnement/commissions, " +
    "avance sur vente, coopérative, vérification, livraison ou signalement."
  )
}
