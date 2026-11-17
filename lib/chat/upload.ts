/**
 * Upload chat sécurisé — MIME, taille, nom sanitisé, barre de progression, URL signée.
 * Chemin Storage : `{userId}/{conversationId}/{ts}-{safeName}` (RLS folder = auth.uid()).
 */

import { z } from "zod"

export const CHAT_MEDIA_BUCKET = "chat-media"
export const CHAT_MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const CHAT_MAX_FILE_BYTES = 10 * 1024 * 1024
export const CHAT_MAX_VOICE_BYTES = 12 * 1024 * 1024
/** Durée de vie des liens signés (7 jours) — renouvelables à l’affichage. */
export const CHAT_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

export const CHAT_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

export const CHAT_FILE_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
] as const

export const CHAT_VOICE_MIME = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/aac",
  "audio/wav",
  "audio/x-m4a",
  "audio/mp3",
] as const

export type ChatMediaKind = "image" | "file" | "voice"

export const chatMediaPrepareSchema = z.object({
  conversationId: z.string().uuid(),
  kind: z.enum(["image", "file", "voice"]),
  mime: z.string().min(3).max(120),
  size: z.number().int().positive().max(CHAT_MAX_FILE_BYTES),
  fileName: z.string().min(1).max(180),
})

export type ChatMediaPrepareInput = z.infer<typeof chatMediaPrepareSchema>

export class ChatUploadError extends Error {
  constructor(
    message: string,
    public code:
      | "mime"
      | "size"
      | "auth"
      | "path"
      | "network"
      | "storage"
      | "invalid" = "invalid",
  ) {
    super(message)
    this.name = "ChatUploadError"
  }
}

/** Retire caractères dangereux ; garde extension courte. */
export function sanitizeFileName(raw: string): string {
  const base = (raw || "fichier")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "fichier"
  const normalized = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80)
  const cleaned = normalized.replace(/^-+|-+$/g, "") || "fichier"
  // Évite double extensions exotiques
  const parts = cleaned.split(".")
  if (parts.length === 1) return cleaned.toLowerCase()
  const ext = parts.pop()!.toLowerCase().slice(0, 8)
  const stem = parts.join("-").replace(/^-+|-+$/g, "").slice(0, 60) || "fichier"
  return `${stem}.${ext}`
}

export function extensionForMime(mime: string, fallbackName: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-m4a": "m4a",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
  }
  if (map[mime]) return map[mime]
  const fromName = fallbackName.split(".").pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  return "bin"
}

export function validateChatMedia(input: {
  kind: ChatMediaKind
  mime: string
  size: number
}): { ok: true } | { ok: false; error: string } {
  const mime = (input.mime || "").toLowerCase().split(";")[0].trim()
  if (input.kind === "image") {
    if (!(CHAT_IMAGE_MIME as readonly string[]).includes(mime)) {
      return { ok: false, error: "Photo non acceptée (JPG, PNG, WebP ou GIF)." }
    }
    if (input.size > CHAT_MAX_IMAGE_BYTES) {
      return { ok: false, error: "Photo trop lourde (max 8 Mo)." }
    }
    return { ok: true }
  }
  if (input.kind === "voice") {
    const ok =
      (CHAT_VOICE_MIME as readonly string[]).includes(mime) ||
      mime.startsWith("audio/")
    if (!ok) return { ok: false, error: "Format vocal non supporté." }
    if (input.size > CHAT_MAX_VOICE_BYTES) {
      return { ok: false, error: "Vocal trop long (max 12 Mo)." }
    }
    return { ok: true }
  }
  if (!(CHAT_FILE_MIME as readonly string[]).includes(mime)) {
    return {
      ok: false,
      error: "Document non accepté (PDF, Word, Excel, texte ou ZIP).",
    }
  }
  if (input.size > CHAT_MAX_FILE_BYTES) {
    return { ok: false, error: "Fichier trop lourd (max 10 Mo)." }
  }
  return { ok: true }
}

/** Construit le chemin Storage compatible RLS (1er segment = userId). */
export function buildChatStoragePath(input: {
  userId: string
  conversationId: string
  mime: string
  fileName: string
  now?: number
}): string {
  if (!input.userId || !/^[0-9a-f-]{36}$/i.test(input.userId)) {
    throw new ChatUploadError("Session invalide", "auth")
  }
  if (!input.conversationId || !/^[0-9a-f-]{36}$/i.test(input.conversationId)) {
    throw new ChatUploadError("Conversation invalide", "path")
  }
  const safe = sanitizeFileName(input.fileName)
  const ext = extensionForMime(input.mime, safe)
  const stem = safe.replace(/\.[^.]+$/, "") || "fichier"
  const ts = input.now ?? Date.now()
  return `${input.userId}/${input.conversationId}/${ts}-${stem}.${ext}`
}

export function isChatStoragePath(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\//i.test(value)
}

/** Extrait un path Storage depuis media_url (path brut ou URL publique/signée). */
export function extractChatStoragePath(
  mediaUrl: string | null | undefined,
): string | null {
  if (!mediaUrl) return null
  if (isChatStoragePath(mediaUrl)) return mediaUrl
  try {
    const u = new URL(mediaUrl)
    const markers = [
      `/storage/v1/object/public/${CHAT_MEDIA_BUCKET}/`,
      `/storage/v1/object/sign/${CHAT_MEDIA_BUCKET}/`,
      `/storage/v1/object/authenticated/${CHAT_MEDIA_BUCKET}/`,
    ]
    for (const m of markers) {
      const idx = u.pathname.indexOf(m)
      if (idx >= 0) {
        const rest = decodeURIComponent(u.pathname.slice(idx + m.length))
        return rest.split("?")[0] || null
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export type UploadProgress = {
  percent: number
  stage: "check" | "upload" | "sign" | "done"
}

type SupabaseLike = {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null }
    }>
  }
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{
        data: { signedUrl: string } | null
        error: { message: string } | null
      }>
    }
  }
}

/**
 * Upload XHR avec progression réelle vers Supabase Storage.
 * Retourne path + URL d’affichage (signée de préférence, publique en secours).
 */
export async function uploadChatMedia(opts: {
  supabase: SupabaseLike
  supabaseUrl: string
  /** Clé publique (anon) pour l’en-tête apikey Storage */
  anonKey?: string
  userId: string
  conversationId: string
  file: Blob
  fileName: string
  mime: string
  kind: ChatMediaKind
  onProgress?: (p: UploadProgress) => void
}): Promise<{ path: string; displayUrl: string; contentType: string }> {
  const mime = (opts.mime || opts.file.type || "application/octet-stream")
    .toLowerCase()
    .split(";")[0]
    .trim()
  const check = validateChatMedia({
    kind: opts.kind,
    mime,
    size: opts.file.size,
  })
  opts.onProgress?.({ percent: 5, stage: "check" })
  if (!check.ok) throw new ChatUploadError(check.error, "mime")

  const path = buildChatStoragePath({
    userId: opts.userId,
    conversationId: opts.conversationId,
    mime,
    fileName: opts.fileName,
  })

  const {
    data: { session },
  } = await opts.supabase.auth.getSession()
  if (!session?.access_token) {
    throw new ChatUploadError("Reconnecte-toi pour envoyer ce fichier", "auth")
  }

  const endpoint = `${opts.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${CHAT_MEDIA_BUCKET}/${path}`
  const apiKey =
    opts.anonKey ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        ""
      : "") ||
    session.access_token

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", endpoint)
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`)
    xhr.setRequestHeader("apikey", apiKey)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.setRequestHeader("Content-Type", mime)

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return
      const pct = Math.min(90, Math.round(8 + (ev.loaded / ev.total) * 82))
      opts.onProgress?.({ percent: pct, stage: "upload" })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.({ percent: 92, stage: "sign" })
        resolve()
        return
      }
      let msg = "Envoi impossible"
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        msg = body.message || body.error || msg
      } catch {
        /* ignore */
      }
      if (/mime|type|allowed/i.test(msg)) {
        reject(new ChatUploadError("Ce type de fichier n’est pas accepté.", "mime"))
      } else if (/size|large|limit/i.test(msg)) {
        reject(new ChatUploadError("Fichier trop lourd.", "size"))
      } else if (/row-level|policy|403|401/i.test(msg)) {
        reject(new ChatUploadError("Accès refusé. Réessaie ou reconnecte-toi.", "auth"))
      } else {
        reject(new ChatUploadError("Envoi échoué. Réessaie.", "storage"))
      }
    }
    xhr.onerror = () =>
      reject(new ChatUploadError("Connexion interrompue.", "network"))
    xhr.send(opts.file)
  })

  const { data: signed, error: signErr } = await opts.supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, CHAT_SIGNED_URL_TTL_SEC)

  const displayUrl = signed?.signedUrl || ""
  if (signErr || !displayUrl) {
    throw new Error("Lien média indisponible")
  }

  opts.onProgress?.({ percent: 100, stage: "done" })
  return { path, displayUrl, contentType: mime }
}

/** Résout une URL affichable (rafraîchit le lien signé si besoin). */
export async function resolveChatMediaUrl(
  supabase: SupabaseLike,
  mediaUrl: string | null | undefined,
): Promise<string | null> {
  if (!mediaUrl) return null
  const path = extractChatStoragePath(mediaUrl)
  if (!path) return mediaUrl
  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, CHAT_SIGNED_URL_TTL_SEC)
  if (!error && data?.signedUrl) return data.signedUrl
  return null
}
