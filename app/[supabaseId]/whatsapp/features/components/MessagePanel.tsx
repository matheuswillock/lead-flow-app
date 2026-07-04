"use client"

import { useEffect, useRef } from 'react'
import { Loader2, Phone, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { AssignmentControl } from './AssignmentControl'
import { ConversationActionsMenu } from './ConversationActionsMenu'
import { EditContactNameDialog } from './EditContactNameDialog'
import { ConversationTagPicker } from './ConversationTagPicker'
import { LinkLeadDialog } from './LinkLeadDialog'
import { MessageBubble } from './MessageBubble'
import { MessageBubbleSkeleton } from './MessageBubbleSkeleton'
import { MessageComposer } from './MessageComposer'
import {
  getChatKind,
  getConversationDisplayName,
  getConversationSubtitle,
} from '../utils/whatsappDisplay'

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
    isLoadingOlderMessages,
    hasMoreMessages,
    loadOlderMessages,
    config,
    canManageAssignment,
    isTeamMaster,
    isSyncingGroupParticipants,
    syncGroupParticipants,
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

  const displayName = getConversationDisplayName({
    contactName: selectedConversation.contactName,
    contactPhone: selectedConversation.contactPhone,
    externalChatId: selectedConversation.externalChatId,
  })
  const subtitle = getConversationSubtitle({
    contactPhone: selectedConversation.contactPhone,
    externalChatId: selectedConversation.externalChatId,
  })
  const chatKind = getChatKind(selectedConversation.externalChatId)
  const initials = getInitials(selectedConversation.contactName, selectedConversation.contactPhone)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="size-9">
          {selectedConversation.contactAvatarUrl ? (
            <AvatarImage src={selectedConversation.contactAvatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            {chatKind !== 'group' && <EditContactNameDialog conversation={selectedConversation} />}
            {chatKind === 'group' && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Grupo</Badge>
            )}
          </div>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chatKind === 'group' && isTeamMaster && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isConnected || isSyncingGroupParticipants}
              onClick={() => {
                if (!selectedConversation) return
                void syncGroupParticipants(selectedConversation.id)
              }}
            >
              <RefreshCw className={isSyncingGroupParticipants ? 'animate-spin' : undefined} />
              Sincronizar participantes
            </Button>
          )}
          {canManageAssignment && (
            <LinkLeadDialog selectedConversation={selectedConversation} />
          )}
          <ConversationTagPicker conversation={selectedConversation} />
          <AssignmentControl selectedConversation={selectedConversation} />
          {canManageAssignment && (
            <ConversationActionsMenu conversation={selectedConversation} />
          )}
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
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-muted/30 dark:bg-background"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/whatsapp/chat-background-light.png')] bg-[length:400px] bg-repeat opacity-50 dark:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[url('/whatsapp/chat-background-dark.png')] bg-[length:400px] bg-repeat opacity-[0.14] dark:block"
        />
        <ScrollArea className="h-full flex-1 [&>[data-radix-scroll-area-viewport]>div]:min-h-full">
          <div className="relative z-10 flex flex-col gap-2 px-4 py-4">
          {isLoadingMessages ? (
            <MessageBubbleSkeleton />
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa</p>
            </div>
          ) : (
            <>
              {hasMoreMessages && (
                <div className="flex justify-center pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={isLoadingOlderMessages}
                    className="text-xs"
                  >
                    {isLoadingOlderMessages ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    {isLoadingOlderMessages ? 'Carregando...' : 'Carregar mensagens anteriores'}
                  </Button>
                </div>
              )}
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  previousMessage={index > 0 ? messages[index - 1]! : null}
                />
              ))}
            </>
          )}
          <div ref={scrollBottomRef} />
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Composer */}
      <div className="p-4">
        <MessageComposer disabled={!isConnected} />
      </div>
    </div>
  )
}
