"use client"

import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { ConversationItem } from './ConversationItem'
import { NewConversationDialog } from './NewConversationDialog'
import type { ConversationFilterMode } from '../context/WhatsAppInboxTypes'

const FILTER_TABS: { label: string; value: ConversationFilterMode }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Não lidas', value: 'unread' },
  { label: 'Minhas', value: 'mine' },
  { label: 'Arquivadas', value: 'archived' },
]

export function ConversationList() {
  const {
    conversations,
    isLoadingConversations,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    hasMoreConversations,
    loadMoreConversations,
    unreadTotal,
  } = useWhatsAppInboxContext()

  const isInitialLoading = isLoadingConversations && conversations.length === 0
  const isLoadingMore = isLoadingConversations && conversations.length > 0

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex gap-2">
          <NewConversationDialog triggerLabel="Nova conversa" triggerIcon="conversation" />
          <NewConversationDialog triggerLabel="Novo contato" triggerIcon="contact" />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilterMode(tab.value)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                filterMode === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {tab.label}
              {tab.value === 'unread' && unreadTotal > 0 ? ` (${unreadTotal})` : ''}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {isInitialLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {filterMode === 'unread'
                  ? 'Nenhuma mensagem não lida'
                  : filterMode === 'mine'
                  ? 'Você não tem conversas atribuídas'
                  : filterMode === 'archived'
                  ? 'Nenhuma conversa arquivada'
                  : searchQuery.trim()
                  ? 'Nenhuma conversa encontrada'
                  : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            <>
              {conversations.map((conversation) => (
                <ConversationItem key={conversation.id} conversation={conversation} />
              ))}
              {hasMoreConversations && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full"
                  onClick={loadMoreConversations}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : null}
                  {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
