import { describe, expect, it } from "vitest"
import {
  allowAutoplayFor,
  imageQualityFor,
  isDataSaverStored,
  serializeDataSaver,
  shouldAutoEnableDataSaver,
  IMAGE_QUALITY_DEFAULT,
  IMAGE_QUALITY_SAVER,
} from "@/lib/data-saver"

describe("data-saver helpers", () => {
  it("lit le flag localStorage", () => {
    expect(isDataSaverStored("1")).toBe(true)
    expect(isDataSaverStored("0")).toBe(false)
    expect(isDataSaverStored(null)).toBe(false)
  })

  it("qualité image 60 si actif sinon 75", () => {
    expect(imageQualityFor(true)).toBe(IMAGE_QUALITY_SAVER)
    expect(imageQualityFor(false)).toBe(IMAGE_QUALITY_DEFAULT)
  })

  it("bloque l'autoplay en mode économie", () => {
    expect(allowAutoplayFor(true)).toBe(false)
    expect(allowAutoplayFor(false)).toBe(true)
  })

  it("auto-enable via saveData seulement sans préférence stockée", () => {
    expect(shouldAutoEnableDataSaver(null, true)).toBe(true)
    expect(shouldAutoEnableDataSaver(undefined, true)).toBe(true)
    expect(shouldAutoEnableDataSaver(null, false)).toBe(false)
    expect(shouldAutoEnableDataSaver("0", true)).toBe(false)
    expect(shouldAutoEnableDataSaver("1", false)).toBe(true)
  })

  it("sérialise 1/0", () => {
    expect(serializeDataSaver(true)).toBe("1")
    expect(serializeDataSaver(false)).toBe("0")
  })
})
