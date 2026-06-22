"use client"

import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image,
  Mic,
  Sticker,
  Video,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import type { WhatsAppMessage } from '../context/WhatsAppInboxTypes'

interface MessageBubbleProps {
  message: WhatsAppMessage
}

function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'HH:mm')
  } catch {
    return ''
  }
}

type MediaMeta = { icon: React.ReactNode; label: string }

function getMediaMeta(messageType: string): MediaMeta | null {
  const type = messageType.toLowerCase()
  if (type === 'image' || type === 'imagemessage') {
    return { icon: <Image className="size-4 shrink-0" />, label: 'Imagem' }
  }
  if (type === 'audio' || type === 'audiomessage' || type === 'ptt') {
    return { icon: <Mic className="size-4 shrink-0" />, label: 'Mensagem de voz' }
  }
  if (type === 'video' || type === 'videomessage') {
    return { icon: <Video className="size-4 shrink-0" />, label: 'Vídeo' }
  }
  if (type === 'document' || type === 'documentmessage') {
    return { icon: <FileText className="size-4 shrink-0" />, label: 'Documento' }
  }
  if (type === 'sticker' || type === 'stickermessage') {
    return { icon: <Sticker className="size-4 shrink-0" />, label: 'Figurinha' }
  }
  return null
}

function StatusIndicator({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  if (normalized === 'PENDING') {
    return <Clock className="size-3 text-primary-foreground/70" aria-label="Enviando" />
  }
  if (normalized === 'SENT') {
    return <Check className="size-3 text-primary-foreground/70" aria-label="Enviada" />
  }
  if (normalized === 'DELIVERED') {
    return <CheckCheck className="size-3 text-primary-foreground/70" aria-label="Entregue" />
  }
  if (normalized === 'READ') {
    return <CheckCheck className="size-3 text-semantic-info" aria-label="Lida" />
  }
  if (normalized === 'FAILED') {
    return <AlertCircle className="size-3 text-destructive" aria-label="Falha no envio" />
  }
  return null
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { resendMessage, teamMembers } = useWhatsAppInboxContext()
  const isOutbound = message.direction === 'OUTBOUND'
  const time = formatMessageTime(message.sentAt ?? message.createdAt)
  const isFailed = isOutbound && message.status.toUpperCase() === 'FAILED'

  const operatorName = isOutbound && message.sentByProfileId
    ? (teamMembers.find((m) => m.id === message.sentByProfileId)?.name ?? 'Operador')
    : null

  const hasText = Boolean(message.contentText)
  const type = message.messageType.toLowerCase()
  const isAudioType = type === 'audio' || type === 'audiomessage' || type === 'ptt'
  const isAudioWithUrl = !hasText && isAudioType && Boolean(message.mediaUrl)
  const media = !hasText && !isAudioWithUrl ? getMediaMeta(message.messageType) : null

  if (!hasText && !isAudioWithUrl && !media) return null

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[70%] flex-col gap-1 rounded-lg px-3 py-2',
          isOutbound
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground'
        )}
      >
        {hasText ? (
          <p className="text-sm leading-relaxed">{message.contentText}</p>
        ) : isAudioWithUrl ? (
          <audio
            controls
            src={message.mediaUrl!}
            className="w-full max-w-xs"
          />
        ) : (
          <div
            className={cn(
              'flex items-center gap-2 text-sm',
              isOutbound ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {media!.icon}
            <span className="italic">{media!.label}</span>
          </div>
        )}
        <div
          className={cn(
            'flex items-center gap-1',
            isOutbound ? 'justify-end' : 'justify-start'
          )}
        >
          {operatorName && (
            <span className="text-xs opacity-70">{operatorName}</span>
          )}
          {time && (
            <span
              className={cn(
                'text-xs',
                isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
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
  )
}
