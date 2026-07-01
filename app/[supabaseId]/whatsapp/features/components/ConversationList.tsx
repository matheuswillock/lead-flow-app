"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MessagingConversationList } from "@/components/messaging/MessagingConversationList"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { mapWhatsAppConversationToMessaging } from "../utils/mapWhatsAppToMessaging"
import { ConversationItem } from "./ConversationItem"
import { NewConversationDialog } from "./NewConversationDialog"
import type { ConversationFilterMode } from "../context/WhatsAppInboxTypes"

const FILTER_TABS: { label: string; value: ConversationFilterMode; operatorLabel?: string }[] = [
  { label: "Todas", value: "all", operatorLabel: "Minhas e CRM" },
  { label: "Não lidas", value: "unread" },
  { label: "Minhas", value: "mine" },
  { label: "Arquivadas", value: "archived" },
]

function getEmptyMessage(filterMode: ConversationFilterMode, searchQuery: string): string {
  if (filterMode === "unread") return "Nenhuma mensagem não lida"
  if (filterMode === "mine") return "Você não tem conversas atribuídas"
  if (filterMode === "archived") return "Nenhuma conversa arquivada"
  if (searchQuery.trim()) return "Nenhuma conversa encontrada"
  return "Nenhuma conversa ainda"
}

export function ConversationList() {
  const { activeTeam } = useTeamContext()
  const isOperator = activeTeam?.role === "operator"
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

  const isLoadingMore = isLoadingConversations && conversations.length > 0

  return (
    <MessagingConversationList
      conversations={conversations.map(mapWhatsAppConversationToMessaging)}
      isLoading={isLoadingConversations}
      hasMore={hasMoreConversations}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMoreConversations}
      emptyMessage={getEmptyMessage(filterMode, searchQuery)}
      renderItem={(messagingConversation) => {
        const conversation = conversations.find((c) => c.id === messagingConversation.id)
        if (!conversation) return null
        return <ConversationItem conversation={conversation} />
      }}
      header={
        <>
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
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  filterMode === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {isOperator && tab.operatorLabel ? tab.operatorLabel : tab.label}
                {tab.value === "unread" && unreadTotal > 0 ? ` (${unreadTotal})` : ""}
              </button>
            ))}
          </div>
        </>
      }
    />
  )
}
