"use client"

import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { useUserContext } from '@/app/context/UserContext'
import type { WhatsAppConversation } from '../context/WhatsAppInboxTypes'

interface ConversationItemProps {
  conversation: WhatsAppConversation
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''

  try {
    const date = parseISO(dateStr)
    if (isToday(date)) {
      return format(date, 'HH:mm')
    }
    if (isYesterday(date)) {
      return 'ontem'
    }
    return formatDistanceToNow(date, { addSuffix: false, locale: ptBR })
  } catch {
    return ''
  }
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
  }
  return phone.slice(-2)
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return phone
}

export function ConversationItem({ conversation }: ConversationItemProps) {
  const { selectedConversationId, selectConversation } = useWhatsAppInboxContext()
  const { user } = useUserContext()
  const isSelected = selectedConversationId === conversation.id

  const displayName = conversation.contactName ?? formatPhone(conversation.contactPhone)
  const initials = getInitials(conversation.contactName, conversation.contactPhone)
  const relativeTime = formatRelativeTime(conversation.lastMessageAt)

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted',
        isSelected && 'bg-muted'
      )}
      onClick={() => selectConversation(conversation.id)}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
          {relativeTime && (
            <span className="shrink-0 text-xs text-muted-foreground">{relativeTime}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {conversation.lastMessagePreview ?? ''}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {conversation.leadId && (
              <Link2 className="size-3 text-primary" aria-label="Lead vinculado" />
            )}
            {conversation.assignedProfileId && (
              conversation.assignedProfileId === user?.id ? (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Você</Badge>
              ) : (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Atribuída</Badge>
              )
            )}
            {conversation.unreadCount > 0 && (
              <Badge variant="default" className="h-4 px-1.5 text-xs">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
