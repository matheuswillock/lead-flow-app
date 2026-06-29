"use client"



import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns'

import { ptBR } from 'date-fns/locale'

import { Link2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { Badge } from '@/components/ui/badge'

import { cn } from '@/lib/utils'

import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'

import { useUserContext } from '@/app/context/UserContext'

import { getConversationDisplayName } from '../utils/whatsappDisplay'

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



function getAssignedMemberInitials(name: string): string {

  return name

    .split(' ')

    .slice(0, 2)

    .map((w) => w[0] ?? '')

    .join('')

    .toUpperCase()

}



export function ConversationItem({ conversation }: ConversationItemProps) {

  const { selectedConversationId, selectConversation, teamMembers } = useWhatsAppInboxContext()

  const { user } = useUserContext()

  const isSelected = selectedConversationId === conversation.id

  const hasUnread = conversation.unreadCount > 0



  const displayName = getConversationDisplayName({

    contactName: conversation.contactName,

    contactPhone: conversation.contactPhone,

    externalChatId: conversation.externalChatId,

  })

  const initials = getInitials(conversation.contactName, conversation.contactPhone)

  const relativeTime = formatRelativeTime(conversation.lastMessageAt)

  const assignedMember = conversation.assignedProfileId

    ? teamMembers.find((m) => m.id === conversation.assignedProfileId)

    : null



  return (

    <button

      type="button"

      className={cn(

        'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted',

        isSelected && 'bg-muted'

      )}

      onClick={() => selectConversation(conversation.id)}

    >

      <div className="relative shrink-0">

        <Avatar className="size-10">

          {conversation.contactAvatarUrl ? (

            <AvatarImage src={conversation.contactAvatarUrl} alt={displayName} />

          ) : null}

          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>

        </Avatar>

        {hasUnread && (

          <span

            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-semantic-success"

            aria-hidden

          />

        )}

      </div>



      <div className="flex min-w-0 flex-1 flex-col gap-0.5">

        <div className="flex items-center justify-between gap-2">

          <span

            className={cn(

              'truncate text-sm text-foreground',

              hasUnread ? 'font-semibold' : 'font-medium'

            )}

          >

            {displayName}

          </span>

          {relativeTime && (

            <span

              className={cn(

                'shrink-0 text-xs',

                hasUnread ? 'font-medium text-semantic-success' : 'text-muted-foreground'

              )}

            >

              {relativeTime}

            </span>

          )}

        </div>

        <div className="flex items-center justify-between gap-2">

          <span

            className={cn(

              'truncate text-xs',

              hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'

            )}

          >

            {conversation.lastMessagePreview ?? ''}

          </span>

          <div className="flex shrink-0 items-center gap-1">

            {conversation.leadId && (

              <Link2 className="size-3 text-primary" aria-label="Lead vinculado" />

            )}

            {conversation.assignedProfileId && (

              conversation.assignedProfileId === user?.id ? (

                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Você</Badge>

              ) : assignedMember ? (

                <Avatar className="size-5" title={assignedMember.name}>

                  <AvatarFallback className="bg-muted text-[8px] font-medium text-muted-foreground">

                    {getAssignedMemberInitials(assignedMember.name)}

                  </AvatarFallback>

                </Avatar>

              ) : (

                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Atribuída</Badge>

              )

            )}

            {hasUnread && (

              <span

                className="flex size-5 min-w-5 items-center justify-center rounded-full bg-semantic-success px-1 text-[10px] font-semibold text-primary-foreground"

                aria-label={`${conversation.unreadCount} não lida(s)`}

              >

                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}

              </span>

            )}

          </div>

        </div>

      </div>

    </button>

  )

}


