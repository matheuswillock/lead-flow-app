import { createHash } from "node:crypto"
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage"
import { createSupabaseAdmin } from "@/lib/supabase/server"

const ALLOWED_MIME_TYPES = new Set([
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

const MAX_BYTES = 16 * 1024 * 1024

function extensionFromMime(mimeType: string, fileName?: string): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase()
  if (fromName && fromName.length <= 8) return fromName
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

export async function uploadWhatsAppMedia(input: {
  teamId: string
  conversationId: string
  messageId: string
  base64: string
  mimeType: string
  fileName?: string
}): Promise<{ storagePath: string; mediaSha256: string; mediaSizeBytes: number }> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error(`Tipo de mídia não permitido: ${input.mimeType}`)
  }

  const buffer = Buffer.from(input.base64, "base64")
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo de mídia vazio")
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("Arquivo de mídia excede o limite de 16MB")
  }

  const mediaSha256 = createHash("sha256").update(buffer).digest("hex")
  const ext = extensionFromMime(input.mimeType, input.fileName)
  const storagePath = `${input.teamId}/${input.conversationId}/${input.messageId}.${ext}`
  const bucket = STORAGE_BUCKETS.WHATSAPP_MEDIA

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    throw new Error("Falha ao inicializar storage")
  }

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: input.mimeType,
    upsert: true,
  })
  if (error) {
    console.error("[uploadWhatsAppMedia]", error)
    throw new Error(`Falha ao armazenar mídia: ${error.message}`)
  }

  return { storagePath, mediaSha256, mediaSizeBytes: buffer.byteLength }
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
