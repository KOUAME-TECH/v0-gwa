/**
 * Politique de qualification progressive des coopératives GWA.
 * Source de vérité produit — utilisée UI + API + docs BP.
 */

export const COOP_MIN_ACTIVE_MEMBERS = 15
/** Jours après inscription pour atteindre le seuil membres. */
export const COOP_MEMBERS_DEADLINE_DAYS = 14
/** Mois après lesquels les restrictions avancées commencent si non conforme. */
export const COOP_RESTRICTION_START_MONTHS = 3
/** Mois pour fournir les documents légaux. */
export const COOP_DOCS_DEADLINE_MONTHS = 6

export type CoopValidationStatus =
  | "pending_validation" // Coopérative en validation
  | "members_ok" // Seuil 15 membres atteint, docs encore attendus
  | "qualified" // Membres + docs OK (ou admin a validé)
  | "restricted" // Restrictions avancées actives
  | "suspended" // Cas grave — admin only

export type CoopAccessLevel =
  | "basic" // Publier basique, messagerie, vitrine, rejoindre membres
  | "standard" // + catalogue étendu, digest coop
  | "full" // + affacturage prioritaire, multi-rôles avancés, badge coop
  | "restricted_advanced" // basic seulement (avancé coupé)

export type CoopPhase = {
  phase: string
  deadlineLabel: string
  condition: string
  consequence: string
  access: CoopAccessLevel
}

const MS_DAY = 86_400_000

export function daysSince(isoDate: string | Date, now = new Date()): number {
  const start = typeof isoDate === "string" ? new Date(isoDate) : isoDate
  return Math.floor((now.getTime() - start.getTime()) / MS_DAY)
}

export function monthsSince(isoDate: string | Date, now = new Date()): number {
  return daysSince(isoDate, now) / 30.4375
}

export function countActiveMembers(
  members: { is_active?: boolean | null }[] | null | undefined,
): number {
  if (!members?.length) return 0
  return members.filter((m) => m.is_active !== false).length
}

export function hasLegalDocuments(
  docs: unknown,
  registrationNumber?: string | null,
): boolean {
  if (registrationNumber && String(registrationNumber).trim().length >= 3) {
    // RCCM seul ne suffit pas — docs JSON attendus ; mais on accepte combo
  }
  if (!docs) return false
  if (Array.isArray(docs)) return docs.length > 0
  if (typeof docs === "string") {
    try {
      const parsed = JSON.parse(docs)
      return Array.isArray(parsed) && parsed.length > 0
    } catch {
      return docs.trim().length > 0
    }
  }
  return false
}

/**
 * Calcule le statut et le niveau d’accès à partir de l’âge, des membres et des docs.
 * Ne remplace pas une décision admin explicite (suspended / qualified forcé).
 */
export function evaluateCoopQualification(input: {
  createdAt: string | Date
  activeMemberCount: number
  hasLegalDocs: boolean
  adminStatus?: CoopValidationStatus | null
  now?: Date
}): {
  status: CoopValidationStatus
  access: CoopAccessLevel
  membersOk: boolean
  docsOk: boolean
  daysOld: number
  monthsOld: number
  membersDeadlinePassed: boolean
  docsDeadlinePassed: boolean
  restrictionWindow: boolean
  bannerMessage: string
} {
  const now = input.now ?? new Date()
  const daysOld = daysSince(input.createdAt, now)
  const monthsOld = monthsSince(input.createdAt, now)
  const membersOk = input.activeMemberCount >= COOP_MIN_ACTIVE_MEMBERS
  const docsOk = input.hasLegalDocs
  const membersDeadlinePassed = daysOld > COOP_MEMBERS_DEADLINE_DAYS
  const docsDeadlinePassed = monthsOld > COOP_DOCS_DEADLINE_MONTHS
  const restrictionWindow = monthsOld >= COOP_RESTRICTION_START_MONTHS

  if (input.adminStatus === "suspended") {
    return {
      status: "suspended",
      access: "restricted_advanced",
      membersOk,
      docsOk,
      daysOld,
      monthsOld,
      membersDeadlinePassed,
      docsDeadlinePassed,
      restrictionWindow,
      bannerMessage:
        "Compte suspendu. Contacte le support GWA.",
    }
  }
  if (input.adminStatus === "qualified" || (membersOk && docsOk)) {
    return {
      status: "qualified",
      access: "full",
      membersOk,
      docsOk,
      daysOld,
      monthsOld,
      membersDeadlinePassed,
      docsDeadlinePassed,
      restrictionWindow,
      bannerMessage: "Coopérative qualifiée.",
    }
  }

  if (membersOk && !docsOk) {
    const access: CoopAccessLevel =
      restrictionWindow && !docsOk ? "restricted_advanced" : "standard"
    return {
      status: docsDeadlinePassed || restrictionWindow ? "restricted" : "members_ok",
      access,
      membersOk,
      docsOk,
      daysOld,
      monthsOld,
      membersDeadlinePassed,
      docsDeadlinePassed,
      restrictionWindow,
      bannerMessage: docsDeadlinePassed
        ? "Documents légaux en retard — fonctions avancées limitées."
        : restrictionWindow
          ? "Documents légaux manquants — fonctions avancées limitées depuis le 3ᵉ mois."
          : `Membres OK. Documents légaux avant ${COOP_DOCS_DEADLINE_MONTHS} mois.`,
    }
  }

  // Membres insuffisants
  if (restrictionWindow || (membersDeadlinePassed && monthsOld >= 1)) {
    return {
      status: "restricted",
      access: "restricted_advanced",
      membersOk,
      docsOk,
      daysOld,
      monthsOld,
      membersDeadlinePassed,
      docsDeadlinePassed,
      restrictionWindow,
      bannerMessage: `Ajoute ${COOP_MIN_ACTIVE_MEMBERS} membres — fonctions avancées limitées.`,
    }
  }

  return {
    status: "pending_validation",
    access: "basic",
    membersOk,
    docsOk,
    daysOld,
    monthsOld,
    membersDeadlinePassed,
    docsDeadlinePassed,
    restrictionWindow,
    bannerMessage: `En validation — ${COOP_MIN_ACTIVE_MEMBERS} membres sous ${COOP_MEMBERS_DEADLINE_DAYS} jours.`,
  }
}

/** Accès aux features « avancées » (affacturage prioritaire, multi-rôles étendus, etc.). */
export function canUseAdvancedCoopFeatures(access: CoopAccessLevel): boolean {
  return access === "full" || access === "standard"
}

export const COOP_POLICY_PHASES: CoopPhase[] = [
  {
    phase: "Inscription",
    deadlineLabel: "J0",
    condition: "Création du compte / fiche coopérative",
    consequence: "Statut « Coopérative en validation »",
    access: "basic",
  },
  {
    phase: "Activation membres",
    deadlineLabel: `J0 → J${COOP_MEMBERS_DEADLINE_DAYS}`,
    condition: `≥ ${COOP_MIN_ACTIVE_MEMBERS} utilisateurs actifs rattachés`,
    consequence: "Passage vers qualification ; sinon alerte puis restriction progressive",
    access: "basic",
  },
  {
    phase: "Restriction progressive",
    deadlineLabel: `Mois ${COOP_RESTRICTION_START_MONTHS}+`,
    condition: "Seuil membres et/ou docs non atteints",
    consequence: "Fonctions avancées limitées ; fonctions de base maintenues",
    access: "restricted_advanced",
  },
  {
    phase: "Documents légaux",
    deadlineLabel: `Avant mois ${COOP_DOCS_DEADLINE_MONTHS}`,
    condition: "Dépôt des pièces (RCCM, statuts, etc.)",
    consequence: "Éligibilité statut qualifié / badge",
    access: "full",
  },
]
