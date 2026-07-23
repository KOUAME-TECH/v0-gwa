export const PLACE_TYPES = [
  { value: "domicile", label: "Domicile" },
  { value: "champ", label: "Champ / parcelle" },
  { value: "entrepot", label: "Entrepôt" },
  { value: "marche", label: "Marché" },
  { value: "autre", label: "Autre lieu" },
] as const

export type PlaceType = (typeof PLACE_TYPES)[number]["value"]

export type UserPlace = {
  id: string
  user_id: string
  place_type: PlaceType
  label: string
  latitude: number
  longitude: number
  city: string | null
  country: string | null
  region: string | null
  address: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export function placeTypeLabel(type: string): string {
  return PLACE_TYPES.find((p) => p.value === type)?.label || type
}
