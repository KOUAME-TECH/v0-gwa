/** Seuil long-press tactile / souris (ms) — WCAG : alternative via clic aussi. */
export const LONG_PRESS_MS = 480

/**
 * Factory pure pour tests : décide si une durée atteint le seuil.
 */
export function didLongPress(elapsedMs: number, threshold = LONG_PRESS_MS): boolean {
  return elapsedMs >= threshold
}
