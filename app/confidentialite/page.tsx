import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de confidentialité — GWA",
  description:
    "Politique de confidentialité et protection des données personnelles de la plateforme GWA (KOUAME CORPORATION), conforme aux principes RGPD et à la loi ivoirienne.",
}

const LAST_UPDATE = "19 juillet 2026"

function Section({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-[#111827]">
        {n}. {title}
      </h2>
      <div className="space-y-2 text-[14px] leading-relaxed text-[#4B5563]">
        {children}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2">
      <span className="font-medium text-[#111827] sm:w-52 sm:flex-shrink-0">
        {label}
      </span>
      <span>{value}</span>
    </div>
  )
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-dvh bg-[#FFF6E5]">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] safe-top">
        <div className="flex items-center gap-2 h-14 px-3">
          <Link
            href="/profil"
            className="p-2 -ml-1 rounded-full active:bg-neutral-100"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </Link>
          <h1 className="text-lg font-semibold text-[#111827]">
            Politique de confidentialité
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16">
        <div className="rounded-xl bg-[#F39A1F]/10 border border-[#F39A1F]/30 p-3 text-[13px] text-[#4B5563]">
          <strong className="text-[#111827]">Projet en version bêta.</strong>{" "}
          Document informatif en cours de revue juridique, susceptible
          d&apos;évoluer.
        </div>

        <p className="text-xs text-neutral-500">
          Dernière mise à jour : {LAST_UPDATE}
        </p>

        <Section n="1" title="Responsable du traitement">
          <p>
            Le responsable du traitement des données est{" "}
            <strong>KOUAME CORPORATION</strong> (« GWA »), bureau unique à{" "}
            <strong>Abidjan, Côte d&apos;Ivoire</strong>.
          </p>
          <p>
            Pour toute question ou pour exercer vos droits : WhatsApp{" "}
            <strong>+225 07 88 32 60 19</strong> — e-mail{" "}
            <strong>contact@mygwa.org</strong>.
          </p>
        </Section>

        <Section n="2" title="Données que nous collectons">
          <div className="space-y-1.5">
            <Row label="Identité & compte" value="nom, type d'utilisateur, e-mail (optionnel)." />
            <Row label="Téléphone & OTP" value="numéro mobile et codes de vérification (statut vérifié)." />
            <Row label="Localisation" value="ville, région et, si vous l'activez, coordonnées GPS." />
            <Row label="Documents KYC" value="pièce d'identité, RCCM et justificatifs transmis pour vérification." />
            <Row label="Publications" value="photos, vidéos et notes vocales que vous publiez." />
            <Row label="Commandes & paiements" value="historique de commandes, transactions et séquestre." />
            <Row label="Affacturage" value="informations relatives aux demandes de préfinancement." />
            <Row label="Score SCG" value="score et critères calculés à partir de votre activité." />
            <Row label="Messagerie" value="contenu des messages échangés sur la Plateforme." />
            <Row label="Notifications" value="identifiant push (OneSignal) si vous les activez." />
            <Row label="Données techniques" value="adresse IP et journaux, utilisés pour la sécurité et la limitation d'abus." />
          </div>
        </Section>

        <Section n="3" title="Finalités et bases légales">
          <p>Nous traitons vos données pour :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              fournir le Service et exécuter les commandes et le séquestre —{" "}
              <em>exécution du contrat</em> ;
            </li>
            <li>
              vérifier votre identité et lutter contre la fraude et le
              blanchiment — <em>obligation légale / intérêt légitime</em> ;
            </li>
            <li>
              calculer le Score de Confiance GWA et instruire l&apos;affacturage
              — <em>exécution du contrat / intérêt légitime</em> ;
            </li>
            <li>
              vous envoyer des notifications et gérer la géolocalisation —{" "}
              <em>consentement</em> ;
            </li>
            <li>
              assurer la sécurité de la plateforme — <em>intérêt légitime</em> ;
            </li>
            <li>
              répondre à vos demandes de support.
            </li>
          </ul>
        </Section>

        <Section n="4" title="Sous-traitants et destinataires">
          <p>
            Vos données sont partagées uniquement avec les prestataires
            nécessaires au fonctionnement du Service :
          </p>
          <div className="space-y-1.5">
            <Row label="Supabase" value="hébergement de la base de données et stockage des fichiers." />
            <Row label="Feexpay" value="traitement des paiements (mobile money)." />
            <Row label="Africa's Talking" value="envoi des SMS / codes OTP." />
            <Row label="OneSignal" value="notifications push." />
            <Row label="Vercel" value="hébergement de l'application et mesure d'audience." />
            <Row label="AgentMail" value="acheminement des e-mails du formulaire de contact." />
          </div>
          <p>
            Certains prestataires peuvent être situés hors de l&apos;espace
            UEMOA ; des garanties appropriées encadrent alors ces transferts.
            Nous ne vendons pas vos données personnelles.
          </p>
        </Section>

        <Section n="5" title="Durées de conservation">
          <p>
            Les données de compte sont conservées tant que votre compte est
            actif. Les documents et informations KYC ainsi que les données de
            transactions sont conservés pendant la durée requise par les
            obligations légales applicables (notamment en matière de lutte contre
            le blanchiment). Les journaux techniques de sécurité sont conservés
            pour une durée limitée.
          </p>
        </Section>

        <Section n="6" title="Vos droits">
          <p>
            Conformément aux principes du RGPD et à la loi ivoirienne n°2013-450
            relative à la protection des données à caractère personnel, vous
            disposez des droits d&apos;accès, de rectification,
            d&apos;effacement, d&apos;opposition, de limitation et de
            portabilité, ainsi que du droit de retirer votre consentement à tout
            moment.
          </p>
          <p>
            Pour les exercer, contactez-nous (voir section 1). Vous pouvez
            également introduire une réclamation auprès de l&apos;Autorité de
            Régulation des Télécommunications de Côte d&apos;Ivoire (ARTCI).
          </p>
        </Section>

        <Section n="7" title="Cookies, stockage local et PWA">
          <p>
            GWA fonctionne comme une application web progressive (PWA). Nous
            utilisons le stockage local et des cookies strictement nécessaires
            pour maintenir votre session d&apos;authentification, ainsi qu&apos;un
            service worker pour le fonctionnement hors ligne et les
            notifications. Nous n&apos;utilisons pas de publicité tierce ; une
            mesure d&apos;audience agrégée (Vercel Analytics) peut être employée.
          </p>
        </Section>

        <Section n="8" title="Sécurité">
          <p>
            Les données transitent de manière chiffrée. L&apos;accès aux données
            est cloisonné (règles de sécurité au niveau des lignes), les
            écritures sensibles (statut vérifié, suspension, score) sont
            protégées côté serveur, et des mécanismes de limitation de débit
            protègent contre les abus.
          </p>
        </Section>

        <Section n="9" title="Mineurs">
          <p>
            Le Service est réservé aux personnes majeures (18 ans et plus). Nous
            ne collectons pas sciemment de données de mineurs.
          </p>
        </Section>

        <Section n="10" title="Modifications">
          <p>
            La présente politique peut être mise à jour. Les changements prennent
            effet dès leur publication sur la Plateforme.
          </p>
        </Section>

        <div className="pt-2">
          <Link
            href="/conditions"
            className="text-sm font-medium text-[#2F7D32] underline"
          >
            Voir les Conditions d&apos;utilisation →
          </Link>
        </div>

        <p className="text-center text-xs text-neutral-400 pt-2">
          KOUAME CORPORATION · GWA · Abidjan, Côte d&apos;Ivoire
        </p>
      </main>
    </div>
  )
}
