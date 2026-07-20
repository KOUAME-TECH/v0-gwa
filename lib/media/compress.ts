/**
 * GWA — Compression / redimensionnement d'images côté client avant upload.
 * Réduit fortement le poids (donc la durée d'upload sur réseau mobile 3G/4G)
 * en limitant la dimension max et en ré-encodant en JPEG (ou WebP si supporté).
 */

export const MAX_IMAGE_DIMENSION = 1600
export const IMAGE_QUALITY = 0.8

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50 Mo
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // 15 Mo

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
]

export interface MediaValidationResult {
  ok: boolean
  error?: string
}

/** Un type MIME est-il une image acceptée ? (préfixe image/ toléré) */
export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(type) || type.startsWith("image/")
}

/**
 * Valide un fichier vidéo (type + taille). Retourne un message FR en cas d'échec.
 * Pur et testable : ne dépend pas du DOM.
 */
export function validateVideoFile(file: {
  type: string
  size: number
}): MediaValidationResult {
  const typeOk =
    ACCEPTED_VIDEO_TYPES.includes(file.type) || file.type.startsWith("video/")
  if (!typeOk) {
    return { ok: false, error: "Format vidéo non supporté (mp4, webm)" }
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: `Vidéo trop lourde (max ${humanFileSize(MAX_VIDEO_BYTES)})` }
  }
  return { ok: true }
}

/**
 * Valide un fichier audio (type + taille). Retourne un message FR en cas d'échec.
 */
export function validateAudioFile(file: {
  type: string
  size: number
}): MediaValidationResult {
  const typeOk =
    ACCEPTED_AUDIO_TYPES.includes(file.type) || file.type.startsWith("audio/")
  if (!typeOk) {
    return { ok: false, error: "Format audio non supporté" }
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: `Audio trop lourd (max ${humanFileSize(MAX_AUDIO_BYTES)})` }
  }
  return { ok: true }
}

export type PostMediaItem = { url: string; type: "image" | "video" }

/**
 * Construit le tableau media_urls d'une publication à partir des URLs uploadées.
 * (Les images d'abord, puis l'éventuelle vidéo.) L'audio est stocké séparément
 * dans posts.audio_url — il n'entre pas dans media_urls.
 */
export function buildPostMediaPayload(
  imageUrls: string[],
  videoUrl: string | null,
): PostMediaItem[] {
  const media: PostMediaItem[] = imageUrls.map((url) => ({ url, type: "image" }))
  if (videoUrl) media.push({ url: videoUrl, type: "video" })
  return media
}

/** Valeurs autorisées par scripts/schema/038_whatsapp_audio_rich_media.sql */
export const ALLOWED_POST_TYPES = [
  "post",
  "story",
  "repost",
  "general",
  "media",
  "audio",
  "rich_media",
  "question",
  "astuce",
  "temoignage",
  "annonce",
] as const

export type GwaPostType = "general" | "media" | "audio" | "rich_media"

/**
 * post_type aligné sur le CHECK DB (038 : audio + rich_media).
 * WhatsApp-style :
 *   • voix seule → audio
 *   • 2+ canaux (photo+voix, photo+vidéo+voix…) → rich_media
 *   • photo ou vidéo seule → media
 */
export function resolvePostType(input: {
  hasImages?: boolean
  hasVideo?: boolean
  hasAudio?: boolean
}): GwaPostType {
  const channels = [
    Boolean(input.hasImages),
    Boolean(input.hasVideo),
    Boolean(input.hasAudio),
  ].filter(Boolean).length

  if (channels >= 2) return "rich_media"
  if (input.hasAudio) return "audio"
  if (input.hasImages || input.hasVideo) return "media"
  return "general"
}

/** Statut catalogue après modération admin (CHECK: draft|active|paused|sold_out). */
export function productStatusAfterModeration(
  action: "approve" | "reject",
): "active" | "paused" {
  return action === "approve" ? "active" : "paused"
}

function supportsWebp(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return canvas.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    return false
  }
}

/**
 * Compresse une image. Les GIF (potentiellement animés) sont laissés tels quels.
 * Retourne un nouveau File compressé, ou le fichier original en cas d'échec.
 */
export async function compressImage(
  file: File,
  maxDimension = MAX_IMAGE_DIMENSION,
  quality = IMAGE_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file
  }

  try {
    const dataUrl = await readFileAsDataURL(file)
    const img = await loadImage(dataUrl)

    let { width, height } = img
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width)
        width = maxDimension
      } else {
        width = Math.round((width * maxDimension) / height)
        height = maxDimension
      }
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)

    const outType = supportsWebp() ? "image/webp" : "image/jpeg"
    const ext = outType === "image/webp" ? "webp" : "jpg"

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, quality),
    )
    if (!blob) return file

    // Si la compression n'aide pas (petite image déjà optimisée), garder l'original.
    if (blob.size >= file.size && file.type !== "image/png") return file

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function extensionForType(type: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
  }
  return map[type] || type.split("/")[1] || "bin"
}
