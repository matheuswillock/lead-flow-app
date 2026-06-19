"use client"

import { FileText, Image, Mic, Sticker, Video } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND'
  const time = formatMessageTime(message.sentAt ?? message.createdAt)

  const hasText = Boolean(message.contentText)
  const media = !hasText ? getMediaMeta(message.messageType) : null

  if (!hasText && !media) return null

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
          {isOutbound && message.sentByProfileId && (
            <span className="text-xs opacity-70">Operador</span>
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
        </div>
      </div>
    </div>
  )
}
