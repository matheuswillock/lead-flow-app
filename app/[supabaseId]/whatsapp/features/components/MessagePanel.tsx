"use client"

import { useEffect, useRef } from 'react'
import { Wifi, WifiOff, Phone } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { AssignmentControl } from './AssignmentControl'
import { LinkLeadDialog } from './LinkLeadDialog'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return phone
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

export function MessagePanel() {
  const {
    selectedConversation,
    messages,
    isLoadingMessages,
    config,
    canManageAssignment,
  } = useWhatsAppInboxContext()

  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const isConnected = config?.status === 'CONNECTED'

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!selectedConversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Phone className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
        </div>
      </div>
    )
  }

  const displayName =
    selectedConversation.contactName ?? formatPhone(selectedConversation.contactPhone)
  const initials = getInitials(selectedConversation.contactName, selectedConversation.contactPhone)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatPhone(selectedConversation.contactPhone)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManageAssignment && (
            <LinkLeadDialog selectedConversation={selectedConversation} />
          )}
          <AssignmentControl selectedConversation={selectedConversation} />
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className="gap-1"
          >
            {isConnected ? (
              <Wifi className="size-3" />
            ) : (
              <WifiOff className="size-3" />
            )}
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="flex flex-col gap-2 py-4">
          {isLoadingMessages ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={i % 2 === 0 ? 'flex justify-end' : 'flex justify-start'}
              >
                <Skeleton className="h-10 w-2/3 rounded-lg" />
              </div>
            ))
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={scrollBottomRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Composer */}
      <div className="p-4">
        <MessageComposer disabled={!isConnected} />
      </div>
    </div>
  )
}
