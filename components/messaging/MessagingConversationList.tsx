"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { MessagingConversationItem } from "./MessagingConversationItem"
import type { MessagingConversation } from "./types"

export interface MessagingConversationListProps {
  conversations: MessagingConversation[]
  selectedConversationId?: string | null
  onSelectConversation?: (id: string) => void
  isLoading?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  emptyMessage?: string
  header?: ReactNode
  renderItemTrailing?: (conversation: MessagingConversation) => ReactNode
  renderItem?: (conversation: MessagingConversation) => ReactNode
  className?: string
}

export function MessagingConversationList({
  conversations,
  selectedConversationId = null,
  onSelectConversation,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  emptyMessage = "Nenhuma conversa ainda",
  header,
  renderItemTrailing,
  renderItem,
  className,
}: MessagingConversationListProps) {
  const isInitialLoading = isLoading && conversations.length === 0

  return (
    <div className={className ?? "flex w-80 min-w-0 shrink-0 flex-col overflow-hidden border-r border-border"}>
      {header ? <div className="flex flex-col gap-2 p-3">{header}</div> : null}

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
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <>
              {conversations.map((conversation) =>
                renderItem ? (
                  <div key={conversation.id}>{renderItem(conversation)}</div>
                ) : (
                  <MessagingConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversationId === conversation.id}
                    onSelect={onSelectConversation}
                    trailing={renderItemTrailing?.(conversation)}
                  />
                )
              )}
              {hasMore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : null}
                  {isLoadingMore ? "Carregando..." : "Carregar mais"}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
