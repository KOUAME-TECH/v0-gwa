import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions d'utilisation — GWA",
  description:
    "Conditions générales d'utilisation et de vente de la plateforme GWA (KOUAME CORPORATION) : marketplace agricole, paiement GeniusPay, séquestre applicatif, données ARTCI, droit OHADA.",
}

const LAST_UPDATE = "25 novembre 2026"

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

        <p className="text-xs text-neutral-600">
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

        <Section n="6" title="Commandes, paiement GeniusPay et séquestre applicatif">
          <p>
            Les paiements sont encaissés par notre prestataire de paiement{" "}
            <strong>GeniusPay</strong> (mobile money et page de paiement
            sécurisée), en francs CFA (XOF). GWA ne conserve aucune donnée de
            carte ni code de mobile money.
          </p>
          <p>
            Le montant payé est placé sous <strong>séquestre applicatif
            GWA</strong> : GWA retient l&apos;argent sur le compte marchand de
            la Plateforme et ne le libère au vendeur qu&apos;après confirmation
            de la bonne réception par l&apos;acheteur, ou selon les règles de
            résolution des litiges. Ce séquestre est un mécanisme contractuel de
            la Plateforme ; il ne s&apos;agit ni d&apos;un compte bancaire
            séquestre, ni d&apos;un service de GeniusPay.
          </p>
          <p>
            Les versements aux vendeurs sont effectués par GWA après libération.
            Aucun portefeuille électronique (« wallet ») n&apos;est proposé
            tant que GWA n&apos;a pas obtenu l&apos;agrément requis de la BCEAO
            ou conclu un partenariat avec un établissement agréé.
          </p>
          <p>
            GWA agit en tant qu&apos;intermédiaire technique et n&apos;est pas
            partie au contrat de vente conclu entre acheteur et vendeur.
          </p>
        </Section>

        <Section n="6 bis" title="Conditions générales de vente : tarifs GWA">
          <p>
            Acheteurs : frais de service de <strong>250 F CFA par
            opération</strong>, affichés avant le paiement.
          </p>
          <p>
            Producteurs : Graine 0 F/mois et commission de 9 % ; Pousse
            3 000 F/mois et 8 % ; Récolte 8 000 F/mois et 7 %. Coopératives :
            Coopérative 8 000 F/mois et 7 % ; Union 20 000 F/mois et 6 % ;
            Fédération sur devis, 5 % au plus. La commission est prélevée sur le
            montant de la vente au moment de la libération du séquestre.
          </p>
          <p>
            Les abonnements sont payables d&apos;avance, sans reconduction
            forcée. Les prix des produits sont fixés librement par les vendeurs
            et s&apos;entendent toutes taxes éventuelles comprises, sauf mention
            contraire.
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
            est exprimé sur une échelle de 0 à 1000. Il est fourni à titre indicatif et ne constitue pas une notation
            financière officielle ni un conseil.
          </p>
          <p>
            Méthode : le SCG suit la méthode des « 5C » utilisée par les banques —
            Caractère (25 %), Capacité (25 %), Capital (15 %), Garanties (20 %) et
            Conditions (15 %). Données utilisées : vérification d&apos;identité et de
            téléphone, ancienneté, commandes, livraisons, litiges, avis reçus,
            signalements confirmés, réactivité aux messages, paiements, stock publié,
            surface et équipements déclarés, séquestre, créances, appartenance à une
            coopérative, parcelles géolocalisées, certifications, filière, zone et prix
            de référence. Le contenu des messages n&apos;est pas lu : seuls les délais
            de réponse sont mesurés. Une donnée absente reçoit une valeur neutre et
            prudente, jamais un bonus.
          </p>
          <p>
            Le score est calculé uniquement par les serveurs de GWA ; il ne peut pas
            être modifié par un membre. Des plafonds s&apos;appliquent en cas de compte
            suspendu, d&apos;identité non vérifiée, de compte de moins de 90 jours, de
            ventes ou d&apos;avis entre comptes liés, ou de hausse anormale des ventes.
            Le seuil « bancable » est de 500 sur 1000 avec identité vérifiée. Vous
            pouvez consulter le détail de votre score (les 5C et les principaux
            facteurs) sur la page Score, et demander une révision humaine via le
            support.
          </p>
        </Section>

        <Section n="8 bis" title="Assistante Yelly (IA)">
          <p>
            Yelly est une assistante d&apos;intelligence artificielle. Ses
            réponses (prix de référence, reformulation, résumé d&apos;accord)
            sont indicatives :{" "}
            <strong>Yelly est une assistante, pas une décision financière.</strong>{" "}
            Les coordonnées personnelles sont masquées avant tout envoi au
            modèle.
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

        <Section n="12 bis" title="Données personnelles (ARTCI)">
          <p>
            Les données personnelles sont traitées conformément à la loi
            ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des
            données à caractère personnel, sous le contrôle de l&apos;Autorité
            de Régulation des Télécommunications/TIC de Côte d&apos;Ivoire
            (ARTCI). Le détail (finalités, durées, droits, effacement) figure
            dans la{" "}
            <Link href="/confidentialite" className="underline">
              Politique de confidentialité
            </Link>
            .
          </p>
        </Section>

        <Section n="13" title="Droit applicable et litiges">
          <p>
            Les présentes conditions sont régies par le droit de la
            <strong> République de Côte d&apos;Ivoire</strong>, notamment les
            Actes uniformes de l&apos;<strong>OHADA</strong> (dont
            l&apos;Acte uniforme relatif au droit commercial général) et la
            réglementation UEMOA applicable aux paiements. À défaut de
            règlement amiable dans un délai de 30 jours, le litige est porté
            devant le Tribunal de commerce d&apos;Abidjan.
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

        <p className="text-center text-xs text-neutral-600 pt-2">
          KOUAME CORPORATION · GWA · Abidjan, Côte d&apos;Ivoire
        </p>
      </main>
    </div>
  )
}
