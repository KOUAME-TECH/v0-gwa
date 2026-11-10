/**
 * QR Code ISO/IEC 18004 — SVG data-URI pour bon de commande imprimable.
 * Utilise la lib `qrcode` (encodeur conforme) + rendu SVG sync.
 */

import QRCode from "qrcode"

/** Encode payload en matrice QR (modules booléens) — ISO byte mode. */
export function qrMatrix(text: string): boolean[][] {
  const qr = QRCode.create(text, {
    errorCorrectionLevel: "M",
  })
  const size = qr.modules.size
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  )
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      matrix[y][x] = Boolean(qr.modules.get(x, y))
    }
  }
  return matrix
}

/** Data-URI SVG scannable (ISO) pour impression / écran. */
export function qrSvgDataUri(text: string, px = 120): string {
  const m = qrMatrix(text)
  const size = m.length
  const cell = px / size
  let rects = ""
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m[y][x]) {
        rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#111"/>`
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" role="img" aria-label="QR code de suivi GWA">${rects}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Vérifie qu’une matrice a les finders ISO (coins 7×7). */
export function hasIsoFinderPatterns(matrix: boolean[][]): boolean {
  const size = matrix.length
  if (size < 21) return false
  const checkFinder = (ox: number, oy: number) => {
    // Coin externe noir
    if (!matrix[oy][ox] || !matrix[oy][ox + 6] || !matrix[oy + 6][ox]) return false
    // Centre 3×3 approximatif
    return matrix[oy + 3][ox + 3] === true
  }
  return (
    checkFinder(0, 0) &&
    checkFinder(size - 7, 0) &&
    checkFinder(0, size - 7)
  )
}
