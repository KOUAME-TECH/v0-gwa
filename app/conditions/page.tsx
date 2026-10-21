import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions d'utilisation — GWA",
  description:
    "Conditions générales d'utilisation de la plateforme GWA (KOUAME CORPORATION), marketplace agricole avec paiement séquestre, KYC et affacturage.",
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

export default function ConditionsPage() {
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
            Conditions d&apos;utilisation
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16">
        <div className="rounded-xl bg-[#F39A1F]/10 border border-[#F39A1F]/30 p-3 text-[13px] text-[#4B5563]">
          <strong className="text-[#111827]">Projet en version bêta.</strong>{" "}
          Le présent document est fourni à titre informatif et est en cours de
          revue par un conseil juridique. Il est susceptible d&apos;évoluer.
        </div>

        <p className="text-xs text-neutral-500">
          Dernière mise à jour : {LAST_UPDATE}
        </p>

        <Section n="1" title="Éditeur et objet">
          <p>
            La plateforme GWA (« GWA », « la Plateforme », « le Service ») est
            éditée par <strong>KOUAME CORPORATION</strong>, dont le bureau
            unique est situé à <strong>Abidjan, Côte d&apos;Ivoire</strong>.
          </p>
          <p>
            GWA est une place de marché agricole numérique mettant en relation
            producteurs, coopératives, transformateurs et acheteurs. Elle
            propose la mise en vente de produits agricoles, la passation de
            commandes, un paiement sécurisé sous séquestre (escrow), un Score de
            Confiance GWA (SCG) et un service d&apos;affacturage
            (préfinancement de créances).
          </p>
          <p>
            Contact : WhatsApp <strong>+225 07 88 32 60 19</strong> — e-mail{" "}
            <strong>contact@mygwa.org</strong>.
          </p>
        </Section>

        <Section n="2" title="Acceptation des conditions">
          <p>
            La création d&apos;un compte et l&apos;utilisation du Service
            emportent acceptation pleine et entière des présentes conditions. Si
            vous n&apos;acceptez pas ces conditions, vous devez cesser
            d&apos;utiliser la Plateforme.
          </p>
        </Section>

        <Section n="3" title="Compte et authentification">
          <p>
            L&apos;inscription s&apos;effectue à l&apos;aide d&apos;un numéro de
            téléphone mobile vérifié par un code à usage unique (OTP), une
            adresse e-mail pouvant être associée de façon optionnelle. Vous vous
            engagez à fournir des informations exactes, à maintenir la
            confidentialité de vos identifiants et à ne pas créer de comptes
            multiples ou frauduleux. Toute activité réalisée depuis votre compte
            est réputée effectuée par vous.
          </p>
        </Section>

        <Section n="4" title="Vérification d'identité (KYC)">
          <p>
            Certaines fonctionnalités (paiement, affacturage, obtention du badge
            « vérifié ») nécessitent une vérification d&apos;identité. Vous
            pourrez être amené à transmettre des documents (pièce
            d&apos;identité, numéro RCCM pour les entreprises et coopératives,
            justificatifs). Le badge « vérifié » n&apos;est attribué
            qu&apos;après validation effective de votre dossier par
            l&apos;équipe GWA.
          </p>
        </Section>

        <Section n="5" title="Offres et publications des vendeurs">
          <p>
            En publiant une offre ou une annonce, le vendeur garantit
            l&apos;exactitude des informations (nature, quantité, prix,
            origine), la licéité des produits et son droit à les commercialiser.
            Sont interdits les produits illégaux, dangereux, contrefaits ou
            contraires à la réglementation applicable. GWA peut modérer,
            suspendre ou retirer toute publication non conforme, sans préavis.
          </p>
        </Section>

        <Section n="6" title="Commandes et paiement sous séquestre (escrow)">
          <p>
            Les paiements peuvent être opérés via des prestataires de paiement
            (mobile money notamment). Les fonds sont conservés sous séquestre
            puis libérés au vendeur après confirmation de la bonne réception de
            la commande par l&apos;acheteur, ou selon les règles de résolution
            des litiges. GWA agit en tant qu&apos;intermédiaire technique et
            n&apos;est pas partie au contrat de vente conclu entre acheteur et
            vendeur.
          </p>
        </Section>

        <Section n="7" title="Affacturage / préfinancement (disclaimer)">
          <p>
            Le service d&apos;affacturage permet de solliciter un préfinancement
            de créances commerciales. Il s&apos;agit d&apos;un service
            <strong> semi-manuel, discrétionnaire et soumis à conditions</strong>.
            GWA n&apos;est pas un établissement de crédit ni un établissement de
            paiement agréé ; l&apos;octroi, le montant et les conditions
            éventuelles sont décidés au cas par cas et ne constituent ni une
            offre ferme ni une garantie. Aucun droit à financement ne résulte de
            la simple utilisation de la Plateforme.
          </p>
        </Section>

        <Section n="8" title="Score de Confiance GWA (SCG)">
          <p>
            Le SCG est un indicateur interne, calculé à partir de vos données
            d&apos;activité, destiné à faciliter la confiance entre membres. Il
            est fourni à titre indicatif et ne constitue pas une notation
            financière officielle ni un conseil.
          </p>
        </Section>

        <Section n="9" title="Contenus des utilisateurs (photos, vidéos, audio)">
          <p>
            Vous restez propriétaire des contenus que vous publiez (textes,
            photos, vidéos, notes vocales) et concédez à GWA une licence non
            exclusive et gratuite pour les héberger et les afficher dans le
            cadre du Service. Vous garantissez détenir les droits nécessaires et
            vous engagez à ne publier aucun contenu illicite, diffamatoire ou
            portant atteinte aux droits de tiers.
          </p>
        </Section>

        <Section n="10" title="Propriété intellectuelle">
          <p>
            La Plateforme, sa marque, ses logos et ses composants logiciels sont
            protégés. Toute reproduction ou exploitation non autorisée est
            interdite.
          </p>
        </Section>

        <Section n="11" title="Responsabilité">
          <p>
            GWA met en œuvre des moyens raisonnables pour assurer la
            disponibilité et la sécurité du Service, sans garantie
            d&apos;absence d&apos;interruption ou d&apos;erreur. GWA ne saurait
            être tenue responsable des litiges commerciaux entre membres, de la
            qualité des produits, ni des dommages indirects.
          </p>
        </Section>

        <Section n="12" title="Suspension et résiliation">
          <p>
            GWA peut suspendre ou clôturer un compte en cas de manquement aux
            présentes conditions, de fraude ou d&apos;usage abusif. Vous pouvez
            demander la suppression de votre compte à tout moment via le
            support.
          </p>
        </Section>

        <Section n="13" title="Droit applicable et litiges">
          <p>
            Les présentes conditions sont régies par le droit de la
            <strong> République de Côte d&apos;Ivoire</strong> et, le cas
            échéant, par les actes uniformes OHADA et la réglementation UEMOA.
            À défaut de règlement amiable, les tribunaux compétents
            d&apos;Abidjan seront saisis.
          </p>
        </Section>

        <Section n="14" title="Modifications">
          <p>
            GWA peut modifier les présentes conditions à tout moment. Les
            évolutions prennent effet dès leur publication sur la Plateforme.
          </p>
        </Section>

        <div className="pt-2">
          <Link
            href="/confidentialite"
            className="text-sm font-medium text-[#2F7D32] underline"
          >
            Voir la Politique de confidentialité →
          </Link>
        </div>

        <p className="text-center text-xs text-neutral-400 pt-2">
          KOUAME CORPORATION · GWA · Abidjan, Côte d&apos;Ivoire
        </p>
      </main>
    </div>
  )
}
