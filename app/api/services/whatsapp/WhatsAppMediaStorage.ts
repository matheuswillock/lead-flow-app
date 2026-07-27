import { createHash } from "node:crypto"
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage"
import { createSupabaseAdmin } from "@/lib/supabase/server"

export const WHATSAPP_MEDIA_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "video/mp4",
  "video/webm",
])

export const WHATSAPP_MEDIA_MAX_BYTES = 16 * 1024 * 1024
const SIGNED_UPLOAD_TTL_SECONDS = 300

/** MediaRecorder often sends `audio/webm;codecs=opus` — allowlist matches the type before `;`. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() || mimeType.trim().toLowerCase()
}

export function isAllowedWhatsAppMimeType(mimeType: string): boolean {
  return WHATSAPP_MEDIA_ALLOWED_MIME_TYPES.has(normalizeMimeType(mimeType))
}

function extensionFromMime(mimeType: string, fileName?: string): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase()
  if (fromName && fromName.length <= 8 && /^[a-z0-9]+$/.test(fromName)) return fromName
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/webm": "webm",
  }
  return map[mimeType] ?? "bin"
}

export function sanitizeWhatsAppMediaFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "file"
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
  return cleaned.length > 0 ? cleaned : "file"
}

export function buildClientMediaStoragePath(input: {
  teamId: string
  conversationId: string
  clientMessageId: string
  fileName: string
  mimeType: string
}): string {
  const safeName = sanitizeWhatsAppMediaFileName(input.fileName)
  const hasExt = /\.[a-z0-9]{1,8}$/i.test(safeName)
  const name = hasExt ? safeName : `${safeName}.${extensionFromMime(normalizeMimeType(input.mimeType), safeName)}`
  return `${input.teamId}/${input.conversationId}/${input.clientMessageId}/${name}`
}

export function assertMediaPathBelongsToTeam(storagePath: string, teamId: string): boolean {
  return storagePath.startsWith(`${teamId}/`) && !storagePath.includes("..")
}

export async function uploadWhatsAppMedia(input: {
  teamId: string
  conversationId: string
  messageId: string
  base64: string
  mimeType: string
  fileName?: string
}): Promise<{ storagePath: string; mediaSha256: string; mediaSizeBytes: number }> {
  const buffer = Buffer.from(input.base64, "base64")
  return uploadWhatsAppMediaBuffer({
    teamId: input.teamId,
    conversationId: input.conversationId,
    objectId: input.messageId,
    buffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
  })
}

export async function uploadWhatsAppMediaBuffer(input: {
  teamId: string
  conversationId: string
  objectId: string
  buffer: Buffer
  mimeType: string
  fileName?: string
  storagePath?: string
}): Promise<{ storagePath: string; mediaSha256: string; mediaSizeBytes: number }> {
  const mimeType = normalizeMimeType(input.mimeType)
  if (!WHATSAPP_MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipo de mídia não permitido: ${input.mimeType}`)
  }
  if (input.buffer.byteLength === 0) {
    throw new Error("Arquivo de mídia vazio")
  }
  if (input.buffer.byteLength > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new Error("Arquivo de mídia excede o limite de 16MB")
  }

  const mediaSha256 = createHash("sha256").update(input.buffer).digest("hex")
  const ext = extensionFromMime(mimeType, input.fileName)
  const storagePath =
    input.storagePath ?? `${input.teamId}/${input.conversationId}/${input.objectId}.${ext}`
  const bucket = STORAGE_BUCKETS.WHATSAPP_MEDIA

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar storage")
  }

  const { error } = await supabase.storage.from(bucket).upload(storagePath, input.buffer, {
    contentType: mimeType,
    upsert: true,
  })
  if (error) {
    console.error("[uploadWhatsAppMediaBuffer]", { code: "STORAGE_UPLOAD_FAILED" })
    throw new Error(`Falha ao armazenar mídia: ${error.message}`)
  }

  return { storagePath, mediaSha256, mediaSizeBytes: input.buffer.byteLength }
}

export async function createSignedMediaUpload(input: {
  storagePath: string
  expiresInSeconds?: number
}): Promise<{ signedUploadToken: string; expiresAt: string; bucket: string }> {
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar storage")
  }

  const expiresIn = input.expiresInSeconds ?? SIGNED_UPLOAD_TTL_SECONDS
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
    .createSignedUploadUrl(input.storagePath)

  if (error || !data?.signedUrl || !data.token) {
    console.error("[createSignedMediaUpload]", { code: "SIGNED_UPLOAD_FAILED" })
    throw new Error("Falha ao gerar token de upload")
  }

  // Token is used with uploadToSignedUrl; signedUrl alone also accepts PUT.
  // Prefer signedUrl as the upload capability for browser fetch PUT.
  return {
    bucket: STORAGE_BUCKETS.WHATSAPP_MEDIA,
    signedUploadToken: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}

export async function downloadWhatsAppMediaBuffer(storagePath: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
    .download(storagePath)
  if (error || !data) {
    console.error("[downloadWhatsAppMediaBuffer]", { code: "STORAGE_DOWNLOAD_FAILED" })
    return null
  }
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function validateStoredMediaObject(input: {
  storagePath: string
  expectedSha256: string
  expectedSizeBytes: number
  mimeType: string
}): Promise<{ mediaSha256: string; mediaSizeBytes: number }> {
  const mimeType = normalizeMimeType(input.mimeType)
  if (!WHATSAPP_MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("MEDIA_UNSUPPORTED")
  }
  if (input.expectedSizeBytes <= 0 || input.expectedSizeBytes > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new Error("MEDIA_TOO_LARGE")
  }

  const buffer = await downloadWhatsAppMediaBuffer(input.storagePath)
  if (!buffer) {
    throw new Error("MEDIA_UNAVAILABLE")
  }
  if (buffer.byteLength !== input.expectedSizeBytes) {
    throw new Error("MEDIA_HASH_MISMATCH")
  }
  const mediaSha256 = createHash("sha256").update(buffer).digest("hex")
  if (mediaSha256 !== input.expectedSha256.toLowerCase()) {
    throw new Error("MEDIA_HASH_MISMATCH")
  }
  return { mediaSha256, mediaSizeBytes: buffer.byteLength }
}

/** Server-only Evolution bridge. Never log or persist the returned Base64. */
export async function readMediaAsBase64ForProvider(storagePath: string): Promise<string> {
  const buffer = await downloadWhatsAppMediaBuffer(storagePath)
  if (!buffer) {
    throw new Error("MEDIA_UNAVAILABLE")
  }
  if (buffer.byteLength > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new Error("MEDIA_TOO_LARGE")
  }
  return buffer.toString("base64")
}

export async function deleteWhatsAppMedia(storagePath: string): Promise<void> {
  const result = await SupabaseStorageService.deleteFile(
    storagePath,
    STORAGE_BUCKETS.WHATSAPP_MEDIA
  )
  if (!result.success) {
    console.error("[deleteWhatsAppMedia]", { error: result.error })
  }
}

export async function createWhatsAppMediaSignedUrl(
  storagePath: string,
  expiresInSeconds = 120
): Promise<string | null> {
  const result = await SupabaseStorageService.createSignedUrl(
    storagePath,
    STORAGE_BUCKETS.WHATSAPP_MEDIA,
    expiresInSeconds
  )
  return result.success ? result.signedUrl ?? null : null
}

/**
 * Removes storage objects under team folders that are older than the TTL and
 * are not referenced by any WhatsApp message.storagePath.
 * Returns counts only — no paths logged.
 */
export async function deleteOrphanWhatsAppUploads(input: {
  olderThanHours?: number
  limit?: number
  isLinked: (storagePath: string) => Promise<boolean>
}): Promise<{ scanned: number; deleted: number }> {
  const olderThanHours = input.olderThanHours ?? 24
  const limit = input.limit ?? 100
  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return { scanned: 0, deleted: 0 }
  }

  const { data: roots, error } = await supabase.storage
    .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
    .list("", { limit: 200 })
  if (error || !roots) {
    console.error("[deleteOrphanWhatsAppUploads]", { code: "LIST_FAILED" })
    return { scanned: 0, deleted: 0 }
  }

  const cutoff = Date.now() - olderThanHours * 3600_000
  let scanned = 0
  let deleted = 0

  for (const root of roots) {
    if (deleted >= limit) break
    if (!root.name) continue
    const teamId = root.name
    const { data: convFolders } = await supabase.storage
      .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
      .list(teamId, { limit: 100 })
    if (!convFolders) continue

    for (const conv of convFolders) {
      if (deleted >= limit) break
      if (!conv.name) continue
      const prefix = `${teamId}/${conv.name}`
      const { data: objects } = await supabase.storage
        .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
        .list(prefix, { limit: 100 })
      if (!objects) continue

      for (const obj of objects) {
        if (deleted >= limit) break
        if (!obj.name) continue
        scanned += 1
        const updatedAt = obj.updated_at ? Date.parse(obj.updated_at) : Number.NaN
        if (!Number.isFinite(updatedAt) || updatedAt > cutoff) continue

        if (obj.id == null && !obj.metadata) {
          const nestedPrefix = `${prefix}/${obj.name}`
          const { data: nested } = await supabase.storage
            .from(STORAGE_BUCKETS.WHATSAPP_MEDIA)
            .list(nestedPrefix, { limit: 50 })
          if (!nested) continue
          for (const file of nested) {
            if (deleted >= limit || !file.name) continue
            scanned += 1
            const nestedUpdated = file.updated_at ? Date.parse(file.updated_at) : Number.NaN
            if (!Number.isFinite(nestedUpdated) || nestedUpdated > cutoff) continue
            const storagePath = `${nestedPrefix}/${file.name}`
            if (await input.isLinked(storagePath)) continue
            await deleteWhatsAppMedia(storagePath)
            deleted += 1
          }
          continue
        }

        const storagePath = `${prefix}/${obj.name}`
        if (await input.isLinked(storagePath)) continue
        await deleteWhatsAppMedia(storagePath)
        deleted += 1
      }
    }
  }

  return { scanned, deleted }
}

export async function fetchRemoteMediaBuffer(url: string): Promise<{ buffer: Buffer; mimeType?: string }> {
  const response = await fetch(url, { redirect: "error" })
  if (response.status === 404 || response.status === 410) {
    throw new Error("MEDIA_EXPIRED")
  }
  if (!response.ok) {
    throw new Error(`MEDIA_FETCH_${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type")
  return {
    buffer,
    mimeType: contentType?.split(";")[0]?.trim() || undefined,
  }
}
