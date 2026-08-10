/**
 * GWA — F2 Compression images WebP < 200Ko
 * Utilise sharp (installé via pnpm add sharp)
 */
import sharp from "sharp"

const MAX_BYTES = 200_000 // 200 Ko
const MAX_WIDTH = 800
const MAX_HEIGHT = 600

/**
 * Compresse un Buffer image en WebP < 200 Ko.
 * Tente quality 70, puis 50, puis 35 si nécessaire.
 */
export async function compressToWebP(inputBuffer: Buffer): Promise<Buffer> {
  // Tentatives de compression par qualité décroissante
  for (const quality of [70, 50, 35]) {
    const compressed = await sharp(inputBuffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer()

    if (compressed.byteLength <= MAX_BYTES) {
      return compressed
    }
  }

  // Dernier recours : redimensionner à 600x400 + quality 30
  const lastResort = await sharp(inputBuffer)
    .resize(600, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 30 })
    .toBuffer()

  return lastResort
}

/**
 * Compresse depuis un File/Blob (usage route API Next.js)
 */
export async function compressFile(file: File): Promise<{ buffer: Buffer; sizeKb: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const inputBuffer = Buffer.from(arrayBuffer)
  const compressed = await compressToWebP(inputBuffer)
  return {
    buffer: compressed,
    sizeKb: Math.round(compressed.byteLength / 1024),
  }
}

/**
 * Vérifie qu'un buffer est une image valide (jpeg, png, webp, gif)
 */
export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata()
    return ["jpeg", "png", "webp", "gif", "avif"].includes(metadata.format ?? "")
  } catch {
    return false
  }
}
