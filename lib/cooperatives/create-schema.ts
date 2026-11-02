import { z } from "zod"
import { sanitizePlainText } from "@/lib/security/validation"

export const coopCreateSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(120)
    .transform((v) => sanitizePlainText(v, 120)),
  city: z
    .string()
    .min(2)
    .max(80)
    .transform((v) => sanitizePlainText(v, 80)),
  description: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 2000) : "")),
  cooperative_type: z
    .string()
    .max(60)
    .optional()
    .transform((v) => sanitizePlainText(v || "agriculture", 60)),
  sector: z
    .string()
    .max(60)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 60) : undefined)),
  country: z
    .string()
    .max(80)
    .optional()
    .transform((v) => sanitizePlainText(v || "Cote d'Ivoire", 80)),
  address: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 200) : "")),
  phone: z
    .string()
    .max(30)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 30) : "")),
  email: z
    .string()
    .max(120)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 120) : "")),
  registration_number: z
    .string()
    .max(80)
    .optional()
    .transform((v) => (v ? sanitizePlainText(v, 80) : "")),
  founded_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  logo_url: z
    .union([z.string().url().max(500), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
})

export const coopJoinSchema = z.object({
  coop_id: z.string().uuid("coop_id invalide"),
})

export const coopMemberRoleSchema = z.object({
  cooperative_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["admin", "manager", "member"]),
})
