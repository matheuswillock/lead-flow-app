"use client"

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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND'
  const time = formatMessageTime(message.sentAt ?? message.createdAt)

  if (!message.contentText) return null

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
        <p className="text-sm leading-relaxed">{message.contentText}</p>
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
