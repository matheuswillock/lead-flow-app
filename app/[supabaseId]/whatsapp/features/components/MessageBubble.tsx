"use client"

import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"
import { getChatKind } from "../utils/whatsappDisplay"
import { shouldShowOutboundOperatorName } from "../utils/shouldShowOutboundOperatorName"
import { LinkPreviewCard } from "./LinkPreviewCard"
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer"
import { WhatsAppFormattedText } from "../utils/formatWhatsAppMessageText"

interface MessageBubbleProps {
  message: WhatsAppMessage
  previousMessage?: WhatsAppMessage | null
}

const SENDER_NAME_COLORS = [
  "text-semantic-info",
  "text-semantic-warning",
  "text-semantic-success",
  "text-primary",
  "text-accent-foreground",
] as const

function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return ""
  try {
    return format(parseISO(dateStr), "HH:mm")
  } catch {
    return ""
  }
}

function hashSenderColor(name: string): (typeof SENDER_NAME_COLORS)[number] {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SENDER_NAME_COLORS[Math.abs(hash) % SENDER_NAME_COLORS.length]
}

function StatusIndicator({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  if (normalized === "PENDING") {
    return <Clock className="size-3 text-primary-foreground/70" aria-label="Enviando" />
  }
  if (normalized === "SENT") {
    return <Check className="size-3 text-primary-foreground/70" aria-label="Enviada" />
  }
  if (normalized === "DELIVERED") {
    return <CheckCheck className="size-3 text-primary-foreground/70" aria-label="Entregue" />
  }
  if (normalized === "READ") {
    return <CheckCheck className="size-3 text-semantic-info" aria-label="Lida" />
  }
  if (normalized === "FAILED") {
    return <AlertCircle className="size-3 text-destructive" aria-label="Falha no envio" />
  }
  return null
}

function isMediaMessageType(messageType: string): boolean {
  const type = messageType.toUpperCase()
  return ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "STICKER", "PTT"].includes(type)
}

export function MessageBubble({ message, previousMessage = null }: MessageBubbleProps) {
  const { resendMessage, teamMembers, selectedConversation, activeTeamId, contactLookup } =
    useWhatsAppInboxContext()
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const isOutbound = message.direction === "OUTBOUND"
  const time = formatMessageTime(message.sentAt ?? message.createdAt)
  const isFailed = isOutbound && message.status.toUpperCase() === "FAILED"

  const operatorName =
    isOutbound && message.sentByProfileId
      ? (teamMembers.find((m) => m.id === message.sentByProfileId)?.name ?? "Operador")
      : null

  const isGroupChat =
    getChatKind(selectedConversation?.externalChatId) === "group" && !isOutbound
  const showSenderName = isGroupChat && Boolean(message.senderDisplayName)
  const showOperatorName = shouldShowOutboundOperatorName(message, previousMessage)

  const type = message.messageType.toUpperCase()
  const hasText = Boolean(message.contentText?.trim())
  const hasMedia = isMediaMessageType(message.messageType)
  const mediaProxyUrl =
    activeTeamId && hasMedia && !message.id.startsWith("optimistic-")
      ? `/api/v1/teams/${encodeURIComponent(activeTeamId)}/whatsapp/messages/${encodeURIComponent(message.id)}/media`
      : null

  const hasRenderableContent =
    hasText || hasMedia || Boolean(message.linkPreview) || Boolean(message.caption)

  if (!hasRenderableContent) return null

  return (
    <>
      <div className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "flex max-w-[70%] flex-col gap-0.5",
            isOutbound ? "items-end" : "items-start"
          )}
        >
          {showOperatorName && operatorName && (
            <span className="px-1 text-xs text-muted-foreground">{operatorName}</span>
          )}
          <div
            className={cn(
              "flex w-full flex-col gap-1 rounded-lg px-3 py-2",
              isOutbound
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted text-foreground"
            )}
          >
          {showSenderName && message.senderDisplayName && (
            <span className={cn("text-xs font-semibold", hashSenderColor(message.senderDisplayName))}>
              {message.senderDisplayName}
            </span>
          )}

          {isOutbound && message.isAutoResponse && (
            <Badge variant="secondary" className="self-start text-[10px]">
              Automática
            </Badge>
          )}

          {type === "IMAGE" && mediaProxyUrl && (
            <button
              type="button"
              className="overflow-hidden rounded-md"
              onClick={() => setLightboxOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaProxyUrl}
                alt={message.caption ?? "Imagem"}
                className="max-h-64 w-full object-cover"
                loading="lazy"
              />
            </button>
          )}

          {type === "DOCUMENT" && mediaProxyUrl && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border p-2",
                isOutbound ? "border-primary-foreground/20" : "border-border"
              )}
            >
              <FileText className="size-8 shrink-0 opacity-80" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {message.mediaFileName ?? "Documento"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(isOutbound && "text-primary-foreground hover:text-primary-foreground")}
                asChild
              >
                <a href={mediaProxyUrl} target="_blank" rel="noopener noreferrer" download>
                  <Download />
                </a>
              </Button>
            </div>
          )}

          {(type === "AUDIO" || type === "PTT") && mediaProxyUrl && (
            <WhatsAppAudioPlayer
              src={mediaProxyUrl}
              variant={isOutbound ? "outbound" : "inbound"}
            />
          )}

          {type === "VIDEO" && mediaProxyUrl && (
            <video
              src={mediaProxyUrl}
              controls
              className="max-h-64 w-full rounded-md"
              preload="metadata"
            />
          )}

          {hasText && (
            <WhatsAppFormattedText
              text={message.contentText ?? ""}
              variant={isOutbound ? "outbound" : "inbound"}
              contactLookup={contactLookup}
            />
          )}

          {message.linkPreview && (
            <LinkPreviewCard
              preview={message.linkPreview}
              variant={isOutbound ? "outbound" : "inbound"}
            />
          )}

          {message.caption && type !== "TEXT" && (
            <WhatsAppFormattedText
              text={message.caption}
              variant={isOutbound ? "outbound" : "inbound"}
              contactLookup={contactLookup}
            />
          )}

          <div
            className={cn(
              "flex items-center gap-1",
              isOutbound ? "justify-end" : "justify-start"
            )}
          >
            {time && (
              <span
                className={cn(
                  "text-xs",
                  isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {time}
              </span>
            )}
            {isOutbound && <StatusIndicator status={message.status} />}
          </div>

          {isFailed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto self-end px-1.5 py-0.5 text-xs text-destructive hover:text-destructive"
              onClick={() => resendMessage(message.id)}
            >
              Reenviar
            </Button>
          )}
          </div>
        </div>
      </div>

      {lightboxOpen && mediaProxyUrl && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setLightboxOpen(false)}
          aria-label="Fechar visualização"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaProxyUrl}
            alt={message.caption ?? "Imagem"}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      )}
    </>
  )
}
