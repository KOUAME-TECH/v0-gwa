/** Langues voix communautaire — codes BCP-47 simplifiés. */

export type AudioLangCode = "fr" | "wo" | "bm" | "ff" | "dyu" | "mos" | "en"

export const AUDIO_LANGS: { code: AudioLangCode; label: string; utter: string }[] = [
  { code: "fr", label: "Français", utter: "fr-FR" },
  { code: "wo", label: "Wolof", utter: "wo-SN" },
  { code: "bm", label: "Bambara", utter: "bm-ML" },
  { code: "ff", label: "Peul / Fulfulde", utter: "ff-SN" },
  { code: "dyu", label: "Dioula", utter: "dyu-CI" },
  { code: "mos", label: "Moré", utter: "mos-BF" },
  { code: "en", label: "English", utter: "en-GH" },
]

export function resolveUtterLang(code?: string | null): string {
  const found = AUDIO_LANGS.find((l) => l.code === code)
  return found?.utter ?? "fr-FR"
}

export function audioLangLabel(code?: string | null): string | null {
  if (!code || code === "fr") return null
  return AUDIO_LANGS.find((l) => l.code === code)?.label ?? code.toUpperCase()
}
