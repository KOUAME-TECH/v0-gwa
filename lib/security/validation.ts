import { z } from "zod"

/** Strip balises / handlers — sortie texte plain safe pour React. */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[<>]/g, "")
    .trim()
}

/**
 * Sanitize pour filtres PostgREST (.or / .ilike).
 * Retire quotes, opérateurs et séparateurs de filtre.
 */
export function sanitizeForQuery(s: string): string {
  return s
    .replace(/['"`;\\]/g, "")
    .replace(/[,.()]/g, " ")
    .replace(/(--)|(\/\*)|(\*\/)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 120)
}

export function sanitizePlainText(input: string, max = 2000): string {
  return sanitizeHtml(input).slice(0, max)
}

export const phoneCI = z
  .string()
  .regex(/^(\+225|00225)?[0-9]{8,10}$/, "Numero invalide (format CI)")
  .transform((v) => v.replace(/^(\+225|00225)/, "").replace(/\s/g, ""))

export const priceFCFA = z.number().int().min(1).max(999_999_999)
export const quantitySchema = z.number().positive().max(999_999)
export const amountFCFA = z.number().int().min(100).max(100_000_000)

export const loginSchema = z.object({
  email: z.string().email("Email invalide").max(255).toLowerCase().trim(),
  password: z.string().min(8, "Minimum 8 caracteres").max(128),
})

export const signupSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[0-9]/, "Au moins un chiffre")
    .regex(/[^A-Za-z0-9]/, "Au moins un caractere special"),
  fullName: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z\u00C0-\u00FF\s\-']+$/, "Caracteres invalides"),
  role: z.enum([
    "farmer",
    "buyer",
    "cooperative",
    "student",
    "business",
    "transformer",
  ]),
  phone: phoneCI.optional(),
})

export const productSchema = z.object({
  name: z.string().min(3).max(100).transform(sanitizePlainText),
  description: z.string().max(2000).transform((v) => sanitizePlainText(v, 2000)),
  price: priceFCFA,
  quantity: quantitySchema,
  unit: z.enum(["kg", "g", "L", "unite", "tonne", "sac", "carton", "regime"]),
  category: z.string().max(50),
  location: z.string().max(100).optional(),
})

export const messageSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(1000)
    .transform((v) => sanitizePlainText(v, 1000)),
  recipientId: z.string().uuid(),
})

export const commentTextSchema = z
  .string()
  .max(1000)
  .transform((v) => sanitizePlainText(v, 1000))

export const yellyChatSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(800)
    .transform((v) => sanitizePlainText(v, 800)),
  page: z.string().max(120).optional(),
  context: z
    .object({
      productId: z.string().uuid().optional(),
      city: z.string().max(80).optional(),
    })
    .optional(),
})

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export function validateImageUpload(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return { valid: false, error: "Format non autorise. JPG, PNG ou WebP uniquement." }
  if (file.size > MAX_IMAGE_SIZE)
    return { valid: false, error: "Image trop grande. Maximum 5MB." }
  return { valid: true, error: null }
}

/** Token CSRF optionnel (double-submit) — généré côté client si besoin. */
export function generateCSRFToken(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}
