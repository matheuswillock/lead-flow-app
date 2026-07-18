"use client"

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Phone, RefreshCw, UserSquare2, Wifi, WifiOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { useTeamContext } from '@/app/context/TeamContext'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { AssignmentControl } from './AssignmentControl'
import { ConversationActionsMenu } from './ConversationActionsMenu'
import { LeadDetailsSheet } from './LeadDetailsSheet'
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
  const params = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
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

  const [leadSheetOpen, setLeadSheetOpen] = useState(false)
  const isConnected = config?.status === 'CONNECTED'

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
            <>
              {selectedConversation.leadId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setLeadSheetOpen(true)}
                >
                  <UserSquare2 className="size-3.5" />
                  Ver lead
                </Button>
              ) : null}
              <LinkLeadDialog
                selectedConversation={selectedConversation}
                onOpenLeadCard={() => setLeadSheetOpen(true)}
              />
            </>
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
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller className="relative z-10 flex-1">
            <MessageScrollerViewport preserveScrollOnPrepend>
              <MessageScrollerContent>
                {isLoadingMessages ? (
                  <MessageScrollerItem messageId="loading">
                    <MessageBubbleSkeleton />
                  </MessageScrollerItem>
                ) : messages.length === 0 ? (
                  <MessageScrollerItem messageId="empty">
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa</p>
                    </div>
                  </MessageScrollerItem>
                ) : (
                  <>
                    {hasMoreMessages ? (
                      <MessageScrollerItem messageId="load-older">
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
                      </MessageScrollerItem>
                    ) : null}
                    {messages.map((message, index) => (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.direction === 'OUTBOUND'}
                      >
                        <MessageBubble
                          message={message}
                          previousMessage={index > 0 ? messages[index - 1]! : null}
                        />
                      </MessageScrollerItem>
                    ))}
                  </>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <Separator />

      <div className="p-4">
        <MessageComposer disabled={!isConnected} />
      </div>

      <LeadDetailsSheet
        open={leadSheetOpen}
        onOpenChange={setLeadSheetOpen}
        leadId={selectedConversation.leadId}
        teamId={activeTeamId}
        supabaseId={params.supabaseId}
      />
    </div>
  )
}
