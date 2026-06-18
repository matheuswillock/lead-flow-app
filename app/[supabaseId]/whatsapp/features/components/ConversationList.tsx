"use client"

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { ConversationItem } from './ConversationItem'

export function ConversationList() {
  const { conversations, isLoadingConversations, searchQuery, setSearchQuery } =
    useWhatsAppInboxContext()

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {isLoadingConversations ? (
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
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
