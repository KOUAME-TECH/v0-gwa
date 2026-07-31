/**
 * Templates prompts Yelly Ops — ton GWA backoffice.
 */
import type { AdminAiTask } from "@/lib/admin/ai-entitlements"

export const ADMIN_AI_TEMPLATES: Record<
  AdminAiTask,
  { label: string; defaultMessage: string }
> = {
  general: {
    label: "Assistance",
    defaultMessage: "Que dois-je faire ensuite sur ce dossier ?",
  },
  moderation: {
    label: "Modération",
    defaultMessage:
      "Propose une décision Approuver ou Rejeter avec un motif court en français simple, prêt à coller.",
  },
  support_reply: {
    label: "Support",
    defaultMessage:
      "Rédige une réponse support empathique, claire, avec prochaines étapes concrètes.",
  },
  dispute_summary: {
    label: "Litige",
    defaultMessage:
      "Résume le litige, risques escrow, et recommande freeze, release ou investigation.",
  },
  factoring: {
    label: "Affacturage",
    defaultMessage:
      "Liste les points de vigilance SCG / dossier avant approbation affacturage.",
  },
  coop: {
    label: "Coop",
    defaultMessage:
      "Checklist qualification coop : membres, docs, risques, prochaine action admin.",
  },
}

export function buildAdminAiContext(parts: Record<string, string | number | null | undefined>) {
  return Object.entries(parts)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).slice(0, 500)}`)
    .join("\n")
}
