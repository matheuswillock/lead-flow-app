"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Phone } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MessagingConversationList } from "@/components/messaging/MessagingConversationList"
import { MessagingInboxLayout } from "@/components/messaging/MessagingInboxLayout"
import { MessagingMessageBubble } from "@/components/messaging/MessagingMessageBubble"
import { MessagingMessageBubbleSkeleton } from "@/components/messaging/MessagingMessageBubbleSkeleton"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"
import { mapBotMessageToBubble } from "../utils/mapBotMessageToBubble"
import { mapUserLinkToConversation } from "../utils/mapUserLinkToConversation"
import { maskPhone } from "@/lib/masks"

export function BackofficeStudioBotConversasContainer() {
  const {
    channel,
    conversations,
    conversationsFilters,
    selectedUserLinkId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    conversationsPagination,
    setConversationsFilters,
    selectConversation,
    loadChannel,
  } = useBackofficeStudioBot()

  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const [searchInput, setSearchInput] = useState(conversationsFilters.search)

  useEffect(() => {
    setSearchInput(conversationsFilters.search)
  }, [conversationsFilters.search])

  useEffect(() => {
    void loadChannel()
  }, [loadChannel])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== conversationsFilters.search) {
        setConversationsFilters({ search: searchInput })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [conversationsFilters.search, searchInput, setConversationsFilters])

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const messagingConversations = useMemo(
    () => conversations.map(mapUserLinkToConversation),
    [conversations]
  )

  const selectedConversation = conversations.find((c) => c.userLinkId === selectedUserLinkId)
  const mappedMessages = useMemo(
    () => messages.map((m) => mapBotMessageToBubble(m, channel)),
    [channel, messages]
  )

  const displayName = selectedConversation
    ? selectedConversation.profileFullName?.trim() ||
      maskPhone(selectedConversation.normalizedPhone) ||
      selectedConversation.normalizedPhone
    : null

  const initials = (displayName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Conversas</h1>
        <p className="text-sm text-muted-foreground">
          Inbox somente leitura das mensagens trocadas com usuários vinculados.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <MessagingInboxLayout
          className="min-h-[calc(100vh-theme(spacing.48))]"
          list={
            <MessagingConversationList
              conversations={messagingConversations}
              selectedConversationId={selectedUserLinkId}
              onSelectConversation={selectConversation}
              isLoading={isLoadingConversations}
              hasMore={conversationsPagination.hasNextPage}
              emptyMessage={
                conversationsFilters.search.trim()
                  ? "Nenhuma conversa encontrada"
                  : "Nenhuma conversa ainda"
              }
              header={
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-8"
                  />
                </div>
              }
            />
          }
          panel={
            <div className="flex flex-1 flex-col overflow-hidden">
              {!selectedConversation ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Phone className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="size-9">
                      {selectedConversation.profileIconUrl ? (
                        <AvatarImage
                          src={selectedConversation.profileIconUrl}
                          alt={displayName ?? ""}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {maskPhone(selectedConversation.normalizedPhone)}
                      </span>
                      {selectedConversation.profileEmail ? (
                        <span className="text-xs text-muted-foreground">
                          {selectedConversation.profileEmail}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Separator />
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-muted/30 dark:bg-background"
                    />
                    <ScrollArea className="h-full flex-1 [&>[data-radix-scroll-area-viewport]>div]:min-h-full">
                      <div className="relative z-10 flex flex-col gap-2 px-4 py-4">
                        {isLoadingMessages ? (
                          <MessagingMessageBubbleSkeleton />
                        ) : mappedMessages.length === 0 ? (
                          <div className="py-8 text-center">
                            <p className="text-sm text-muted-foreground">
                              Nenhuma mensagem nesta conversa
                            </p>
                          </div>
                        ) : (
                          mappedMessages.map((message, index) => (
                            <MessagingMessageBubble
                              key={message.id}
                              message={message}
                              previousMessage={index > 0 ? mappedMessages[index - 1]! : null}
                            />
                          ))
                        )}
                        <div ref={scrollBottomRef} />
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  )
}
