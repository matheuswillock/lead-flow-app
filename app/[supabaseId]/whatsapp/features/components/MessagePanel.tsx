"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Phone, RefreshCw, Search, UserSquare2, Wifi, WifiOff, X } from 'lucide-react'
import { toast } from 'sonner'
import { toastUserError } from '@/lib/ui/to-user-toast-message'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
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
import { whatsAppInboxService } from '../services/WhatsAppInboxService'
import {
  getChatKind,
  getConversationDisplayName,
  getConversationSubtitle,
} from '../utils/whatsappDisplay'
import { formatMessageDayLabel, isSameMessageDay } from '../utils/messageActions'

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

function MessageDaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-3" role="separator" aria-label={label}>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function ScrollToHighlightedMessage({ messageId }: { messageId: string | null }) {
  const { scrollToMessage } = useMessageScroller()

  useEffect(() => {
    if (!messageId) return
    scrollToMessage(messageId, { align: 'center', behavior: 'smooth' })
  }, [messageId, scrollToMessage])

  return null
}

export function MessagePanel() {
  const params = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
  const {
    selectedConversation,
    selectConversation,
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
    supabaseId,
  } = useWhatsAppInboxContext()

  const [leadSheetOpen, setLeadSheetOpen] = useState(false)
  const [conversationSearch, setConversationSearch] = useState('')
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchAbortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const isConnected = config?.status === 'CONNECTED'

  const clearConversationSearch = useCallback(() => {
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
    setConversationSearch('')
    setHighlightMessageId(null)
    setIsSearching(false)
  }, [])

  useEffect(() => {
    clearConversationSearch()
  }, [selectedConversation?.id, clearConversationSearch])

  useEffect(() => {
    const query = conversationSearch.trim()
    if (!query || !selectedConversation || !activeTeamId) {
      setHighlightMessageId(null)
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    searchAbortRef.current?.abort()
    searchAbortRef.current = controller
    setIsSearching(true)

    const timeoutId = window.setTimeout(() => {
      void whatsAppInboxService
        .searchConversationMessages(
          activeTeamId,
          supabaseId,
          selectedConversation.id,
          query,
          controller.signal
        )
        .then((result) => {
          if (controller.signal.aborted) return
          const firstMatch = result.messages[0]
          if (firstMatch && messagesRef.current.some((message) => message.id === firstMatch.id)) {
            setHighlightMessageId(firstMatch.id)
            return
          }
          setHighlightMessageId(null)
          toast.message(
            result.total === 0
              ? 'Nenhuma mensagem encontrada'
              : `${result.total} mensagem(ns) encontrada(s)${firstMatch ? ' (fora do trecho carregado)' : ''}`
          )
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          toastUserError(error)
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false)
        })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [activeTeamId, conversationSearch, selectedConversation, supabaseId])

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
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:hidden"
            onClick={() => selectConversation(null)}
            aria-label="Voltar para a lista de conversas"
          >
            <ArrowLeft />
          </Button>
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Buscar nesta conversa"
            className="pl-8 pr-10"
            aria-label="Buscar nesta conversa"
            aria-busy={isSearching}
          />
          {conversationSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
              onClick={clearConversationSearch}
              aria-label="Limpar busca nesta conversa"
            >
              <X />
            </Button>
          ) : null}
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
          className="pointer-events-none absolute inset-0 bg-[url('/whatsapp/chat-background-light.svg')] bg-[length:120px] bg-repeat opacity-70 dark:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[url('/whatsapp/chat-background-dark.svg')] bg-[length:120px] bg-repeat opacity-80 dark:block"
        />
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <ScrollToHighlightedMessage messageId={highlightMessageId} />
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
                    {messages.map((message, index) => {
                      const previous = index > 0 ? messages[index - 1]! : null
                      const showDaySeparator =
                        !previous ||
                        !isSameMessageDay(previous.createdAt, message.createdAt)
                      const dayLabel = formatMessageDayLabel(new Date(message.createdAt))
                      const isHighlighted = highlightMessageId === message.id

                      return (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                          scrollAnchor={message.direction === 'OUTBOUND'}
                          className={isHighlighted ? 'rounded-md ring-2 ring-primary/40' : undefined}
                        >
                          {showDaySeparator ? <MessageDaySeparator label={dayLabel} /> : null}
                          <MessageBubble
                            message={message}
                            previousMessage={previous}
                          />
                        </MessageScrollerItem>
                      )
                    })}
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
