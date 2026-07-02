import type { WhatsAppMessageType } from "@prisma/client"
import { sanitizeDbText, stripHtmlTags } from "@/lib/whatsapp/sanitize-db-text"

export interface ParsedEvoMessageContent {
  messageType: WhatsAppMessageType
  contentText: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaFileName: string | null
  caption: string | null
  linkPreview: {
    title: string | null
    description: string | null
    imageUrl: string | null
    url: string | null
  } | null
}

const EMPTY_CONTENT: ParsedEvoMessageContent = {
  messageType: "UNKNOWN",
  contentText: null,
  mediaUrl: null,
  mediaMimeType: null,
  mediaFileName: null,
  caption: null,
  linkPreview: null,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>
  }
  return null
}

function pickMediaUrl(media: Record<string, unknown>): string | null {
  const url = media["url"]
  if (typeof url === "string" && url.length > 0) return url

  const directPath = media["directPath"]
  if (typeof directPath === "string" && directPath.length > 0) return directPath

  return null
}

function pickMimeType(media: Record<string, unknown>): string | null {
  const mimetype = media["mimetype"]
  return typeof mimetype === "string" ? mimetype : null
}

function pickCaption(media: Record<string, unknown>): string | null {
  const caption = media["caption"]
  return typeof caption === "string" && caption.length > 0 ? caption : null
}

function pickFileName(media: Record<string, unknown>): string | null {
  const fileName = media["fileName"]
  return typeof fileName === "string" && fileName.length > 0 ? fileName : null
}

function fromMediaMessage(
  messageType: WhatsAppMessageType,
  media: Record<string, unknown>
): ParsedEvoMessageContent {
  return {
    messageType,
    contentText: null,
    mediaUrl: pickMediaUrl(media),
    mediaMimeType: pickMimeType(media),
    mediaFileName: pickFileName(media),
    caption: pickCaption(media),
    linkPreview: null,
  }
}

function extractThumbnailUrl(extended: Record<string, unknown>): string | null {
  const thumbnailUrl = extended["thumbnailUrl"]
  if (typeof thumbnailUrl === "string" && thumbnailUrl.startsWith("http")) {
    return thumbnailUrl
  }

  const jpegThumbnail = extended["jpegThumbnail"]
  if (typeof jpegThumbnail === "string" && jpegThumbnail.length > 0) {
    const isDataUrl = jpegThumbnail.startsWith("data:")
    return isDataUrl ? jpegThumbnail : `data:image/jpeg;base64,${jpegThumbnail}`
  }

  return null
}

function parseLinkPreview(extended: Record<string, unknown>): ParsedEvoMessageContent["linkPreview"] {
  const title = stripHtmlTags(typeof extended["title"] === "string" ? extended["title"] : null)
  const description = stripHtmlTags(typeof extended["description"] === "string" ? extended["description"] : null)
  const matchedText = typeof extended["matchedText"] === "string" ? extended["matchedText"] : null
  const canonicalUrl = typeof extended["canonicalUrl"] === "string" ? extended["canonicalUrl"] : null
  const url = canonicalUrl ?? matchedText
  if (!title && !description && !url) return null
  const imageUrl = extractThumbnailUrl(extended)
  return { title, description, imageUrl, url }
}

export function parseEvoMessageContent(messageData: unknown): ParsedEvoMessageContent {
  const message = asRecord(messageData)
  if (!message) return EMPTY_CONTENT

  const conversation = message["conversation"]
  if (typeof conversation === "string") {
    return {
      messageType: "TEXT",
      contentText: sanitizeDbText(conversation),
      mediaUrl: null,
      mediaMimeType: null,
      mediaFileName: null,
      caption: null,
      linkPreview: null,
    }
  }

  const extended = asRecord(message["extendedTextMessage"])
  if (extended && typeof extended["text"] === "string") {
    return {
      messageType: "TEXT",
      contentText: sanitizeDbText(extended["text"]),
      mediaUrl: null,
      mediaMimeType: null,
      mediaFileName: null,
      caption: null,
      linkPreview: parseLinkPreview(extended),
    }
  }

  const image = asRecord(message["imageMessage"])
  if (image) return fromMediaMessage("IMAGE", image)

  const audio = asRecord(message["audioMessage"])
  if (audio) return fromMediaMessage("AUDIO", audio)

  const video = asRecord(message["videoMessage"])
  if (video) return fromMediaMessage("VIDEO", video)

  const document = asRecord(message["documentMessage"])
  if (document) return fromMediaMessage("DOCUMENT", document)

  const sticker = asRecord(message["stickerMessage"])
  if (sticker) return fromMediaMessage("STICKER", sticker)

  if (message["locationMessage"]) {
    return { ...EMPTY_CONTENT, messageType: "LOCATION" }
  }

  if (message["contactMessage"] || message["contactsArrayMessage"]) {
    return { ...EMPTY_CONTENT, messageType: "CONTACT" }
  }

  return EMPTY_CONTENT
}

export function buildMessagePreview(parsed: ParsedEvoMessageContent): string | null {
  if (parsed.contentText) return sanitizeDbText(parsed.contentText.slice(0, 100))
  if (parsed.caption) return sanitizeDbText(parsed.caption.slice(0, 100))
  if (parsed.messageType === "IMAGE") return "[Imagem]"
  if (parsed.messageType === "AUDIO") return "[Áudio]"
  if (parsed.messageType === "VIDEO") return "[Vídeo]"
  if (parsed.messageType === "DOCUMENT") return "[Documento]"
  if (parsed.messageType === "STICKER") return "[Figurinha]"
  if (parsed.messageType === "LOCATION") return "[Localização]"
  if (parsed.messageType === "CONTACT") return "[Contato]"
  return null
}

export function normalizeMessagesUpsertItems(
  data: Record<string, unknown> | unknown[]
): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
  }

  if (data["key"] || data["message"]) {
    return [data]
  }

  return []
}

export function normalizeMessageStatus(rawStatus: unknown): string {
  if (typeof rawStatus === "number") {
    switch (rawStatus) {
      case 0:
        return "FAILED"
      case 2:
        return "SENT"
      case 3:
        return "DELIVERY_ACK"
      case 4:
        return "READ"
      case 5:
        return "READ"
      default:
        return ""
    }
  }

  if (typeof rawStatus === "string") {
    return rawStatus.toUpperCase()
  }

  return ""
}
