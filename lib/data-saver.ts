/** localStorage key — "1" = mode économie de données actif. */
export const DATA_SAVER_KEY = "gwa_data_saver"

export const IMAGE_QUALITY_SAVER = 60
export const IMAGE_QUALITY_DEFAULT = 75

export function isDataSaverStored(raw: string | null | undefined): boolean {
  return raw === "1"
}

export function imageQualityFor(enabled: boolean): number {
  return enabled ? IMAGE_QUALITY_SAVER : IMAGE_QUALITY_DEFAULT
}

export function allowAutoplayFor(enabled: boolean): boolean {
  return !enabled
}

/** Auto-enable when Network Information API reports saveData and no explicit preference. */
export function shouldAutoEnableDataSaver(
  stored: string | null | undefined,
  saveData: boolean | undefined,
): boolean {
  if (stored === "1") return true
  if (stored === "0") return false
  return !!saveData
}

export function serializeDataSaver(enabled: boolean): "1" | "0" {
  return enabled ? "1" : "0"
}
