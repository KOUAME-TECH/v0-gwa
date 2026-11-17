import { z } from "zod"

const text = (max: number) => z.string().trim().max(max)

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalide").max(254),
    password: z
      .string()
      .min(8, "Mot de passe : 8 caractères minimum")
      .max(128, "Mot de passe trop long"),
    name: text(100).min(2, "Nom trop court"),
    userType: text(40).min(1, "Type de compte requis"),
    country: text(80).optional(),
    city: text(80).optional(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions" }),
    }),
  })
  .strip()

export const profileUpdateSchema = z
  .object({
    full_name: text(100).min(2).optional(),
    bio: text(2000).optional(),
    country: text(80).optional(),
    city: text(80).optional(),
    address: text(300).optional(),
    avatar_url: z.string().trim().url().max(500).optional(),
    preferred_language: z.enum(["fr", "en"]).optional(),
    digest_enabled: z.boolean().optional(),
    production_type: text(100).optional(),
    surface_area: z.number().finite().nonnegative().max(1e7).optional(),
    craft_type: text(100).optional(),
    experience_years: z.number().int().min(0).max(100).optional(),
    member_count: z.number().int().min(0).max(1e6).optional(),
    registration_number: text(100).optional(),
  })
  .strict()
