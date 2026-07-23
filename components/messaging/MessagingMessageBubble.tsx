"use client"

import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import { cn } from "@/lib/utils"
import { MessagingFormattedText } from "./formatMessagingText"
import type { MessagingContactLookup, MessagingLinkPreview, MessagingMessage } from "./types"

const SENDER_NAME_COLORS = [
  "text-semantic-info",
  "text-semantic-warning",
  "text-semantic-success",
  "text-primary",
  "text-accent-foreground",
] as const

function formatMessageTime(dateStr: string | null | undefined): string {
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
    return <Clock className="size-3 text-muted-foreground" aria-label="Enviando" />
  }
  if (normalized === "SENT") {
    return <Check className="size-3 text-muted-foreground" aria-label="Enviada" />
  }
  if (normalized === "DELIVERED") {
    return <CheckCheck className="size-3 text-muted-foreground" aria-label="Entregue" />
  }
  if (normalized === "READ") {
    return <CheckCheck className="size-3 text-semantic-info" aria-label="Lida" />
  }
  if (normalized === "PLAYED") {
    return <CheckCheck className="size-3 text-semantic-info" aria-label="Reproduzida" />
  }
  if (normalized === "UNKNOWN") {
    return <Clock className="size-3 text-muted-foreground" aria-label="Confirmação indisponível" />
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

function MessagingLinkPreviewCard({
  preview,
  variant = "inbound",
}: {
  preview: MessagingLinkPreview
  variant?: "inbound" | "outbound"
}) {
  const isOutbound = variant === "outbound"
  const href = preview.url?.startsWith("http") ? preview.url : undefined

  const content = (
    <div
      className={cn(
        "mt-1 overflow-hidden rounded-md border text-left",
        isOutbound
          ? "border-primary-foreground/20 bg-primary-foreground/10"
          : "border-border bg-background/60"
      )}
    >
      {preview.imageUrl ? (
        <img src={preview.imageUrl} alt="" className="max-h-32 w-full object-cover" />
      ) : null}
      <div className="flex flex-col gap-0.5 p-2">
        {preview.title ? (
          <p
            className={cn(
              "line-clamp-2 text-xs font-medium",
              isOutbound && "text-primary-foreground"
            )}
          >
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p
            className={cn(
              "line-clamp-2 text-[11px]",
              isOutbound ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {preview.description}
          </p>
        ) : null}
        {href ? (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">
              {(() => {
                try {
                  return new URL(href).hostname
                } catch {
                  return href
                }
              })()}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block no-underline">
        {content}
      </a>
    )
  }

  return content
}

export interface MessagingMessageBubbleProps {
  message: MessagingMessage
  previousMessage?: MessagingMessage | null
  contactLookup?: MessagingContactLookup
  mediaUrl?: string | null
  operatorDisplayName?: string | null
  showSenderName?: boolean
  showOperatorName?: boolean
  onResend?: (messageId: string) => void
  renderAudio?: (src: string, variant: "inbound" | "outbound") => ReactNode
}

export function MessagingMessageBubble({
  message,
  previousMessage: _previousMessage = null,
  contactLookup,
  mediaUrl = null,
  operatorDisplayName = null,
  showSenderName = false,
  showOperatorName = false,
  onResend,
  renderAudio,
}: MessagingMessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const isOutbound = message.direction === "OUTBOUND"
  const time = formatMessageTime(message.sentAt ?? message.createdAt)
  const isFailed = isOutbound && (message.status ?? "").toUpperCase() === "FAILED"

  const type = message.messageType.toUpperCase()
  const hasText = Boolean(message.contentText?.trim())
  const hasMedia = isMediaMessageType(message.messageType)
  const resolvedMediaUrl = mediaUrl ?? message.mediaUrl ?? null

  const hasRenderableContent =
    hasText || hasMedia || Boolean(message.linkPreview) || Boolean(message.caption)

  if (!hasRenderableContent) return null

  const formatVariant = isOutbound ? "outbound" : "inbound"
  const align = isOutbound ? "end" : "start"
  const bubbleVariant = isOutbound ? "default" : "secondary"

  return (
    <>
      <Message align={align} className="max-w-full">
        <MessageContent className="max-w-[80%]">
          {(showOperatorName && operatorDisplayName) ||
          (showSenderName && message.senderDisplayName) ? (
            <MessageHeader>
              {showOperatorName && operatorDisplayName ? (
                <span className="text-xs text-muted-foreground">{operatorDisplayName}</span>
              ) : null}
              {showSenderName && message.senderDisplayName ? (
                <span
                  className={cn(
                    "text-xs font-semibold",
                    hashSenderColor(message.senderDisplayName)
                  )}
                >
                  {message.senderDisplayName}
                </span>
              ) : null}
            </MessageHeader>
          ) : null}

          <Bubble variant={bubbleVariant} align={align} className="max-w-full">
            <BubbleContent className="flex w-full max-w-full flex-col gap-1">
              {isOutbound && message.isAutoResponse ? (
                <Badge variant="secondary" className="self-start text-[10px]">
                  Automática
                </Badge>
              ) : null}

              {type === "IMAGE" && resolvedMediaUrl ? (
                <button
                  type="button"
                  className="overflow-hidden rounded-md"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={resolvedMediaUrl}
                    alt={message.caption ?? "Imagem"}
                    className="max-h-64 w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ) : null}

              {type === "DOCUMENT" && resolvedMediaUrl ? (
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
                    className={cn(
                      isOutbound && "text-primary-foreground hover:text-primary-foreground"
                    )}
                    asChild
                  >
                    <a href={resolvedMediaUrl} target="_blank" rel="noopener noreferrer" download>
                      <Download />
                    </a>
                  </Button>
                </div>
              ) : null}

              {(type === "AUDIO" || type === "PTT") && resolvedMediaUrl ? (
                renderAudio ? (
                  renderAudio(resolvedMediaUrl, formatVariant)
                ) : (
                  <audio src={resolvedMediaUrl} controls className="max-w-full" preload="metadata" />
                )
              ) : null}

              {type === "VIDEO" && resolvedMediaUrl ? (
                <video
                  src={resolvedMediaUrl}
                  controls
                  className="max-h-64 w-full rounded-md"
                  preload="metadata"
                />
              ) : null}

              {hasText ? (
                <MessagingFormattedText
                  text={message.contentText ?? ""}
                  variant={formatVariant}
                  contactLookup={contactLookup}
                />
              ) : null}

              {message.linkPreview ? (
                <MessagingLinkPreviewCard preview={message.linkPreview} variant={formatVariant} />
              ) : null}

              {message.caption && type !== "TEXT" ? (
                <MessagingFormattedText
                  text={message.caption}
                  variant={formatVariant}
                  contactLookup={contactLookup}
                />
              ) : null}
            </BubbleContent>
          </Bubble>

          <MessageFooter
            className={cn(
              "gap-1 px-1",
              isOutbound ? "text-muted-foreground" : "text-muted-foreground"
            )}
          >
            {time ? <span className="text-xs">{time}</span> : null}
            {isOutbound && message.status ? <StatusIndicator status={message.status} /> : null}
            {isFailed && onResend ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 text-xs text-destructive hover:text-destructive"
                onClick={() => onResend(message.id)}
              >
                Reenviar
              </Button>
            ) : null}
          </MessageFooter>
        </MessageContent>
      </Message>

      {lightboxOpen && resolvedMediaUrl ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setLightboxOpen(false)}
          aria-label="Fechar visualização"
        >
          <img
            src={resolvedMediaUrl}
            alt={message.caption ?? "Imagem"}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      ) : null}
    </>
  )
}

export function shouldShowMessagingOutboundOperatorName(
  message: MessagingMessage,
  previousMessage: MessagingMessage | null
): boolean {
  if (message.direction !== "OUTBOUND") return false
  if (message.isAutoResponse || !message.sentByProfileId) return false

  if (!previousMessage) return true
  if (previousMessage.direction === "INBOUND") return true
  if (previousMessage.sentByProfileId !== message.sentByProfileId) return true

  return false
}
