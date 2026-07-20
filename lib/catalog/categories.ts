/**
 * GWA — Filtrage des catégories (scope beta : agriculture only).
 *
 * Point 12 : l'artisanat (et tout autre type hors agriculture) est retiré du
 * périmètre beta. On centralise ici la règle d'exclusion pour que le catalogue,
 * la page publier et la recherche partagent la même vérité — et qu'un test de
 * non-régression empêche l'artisanat de revenir.
 */

export const BETA_ALLOWED_CATEGORY_TYPES = ["agriculture"] as const

/** Types explicitement bannis du périmètre beta. */
export const BETA_EXCLUDED_CATEGORY_TYPES = [
  "artisanat",
  "artisan",
  "formation",
  "learning",
  "service",
] as const

export interface CategoryLike {
  id?: string
  name?: string
  slug?: string | null
  category_type?: string | null
}

/** Une catégorie est-elle dans le périmètre beta (agriculture) ? */
export function isBetaCategory(category: CategoryLike | null | undefined): boolean {
  if (!category) return false
  const type = (category.category_type || "").toLowerCase().trim()
  if ((BETA_EXCLUDED_CATEGORY_TYPES as readonly string[]).includes(type)) return false
  return (BETA_ALLOWED_CATEGORY_TYPES as readonly string[]).includes(type)
}

/** Ne conserve que les catégories du périmètre beta (exclut artisanat). */
export function filterBetaCategories<T extends CategoryLike>(categories: T[] | null | undefined): T[] {
  if (!Array.isArray(categories)) return []
  return categories.filter((c) => isBetaCategory(c))
}
