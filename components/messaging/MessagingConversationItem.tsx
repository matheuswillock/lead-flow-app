"use client"

import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { MessagingConversation } from "./types"

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ""

  try {
    const date = parseISO(dateStr)
    if (isToday(date)) {
      return format(date, "HH:mm")
    }
    if (isYesterday(date)) {
      return "ontem"
    }
    return formatDistanceToNow(date, { addSuffix: false, locale: ptBR })
  } catch {
    return ""
  }
}

function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

export interface MessagingConversationItemProps {
  conversation: MessagingConversation
  isSelected?: boolean
  onSelect?: (id: string) => void
  trailing?: React.ReactNode
  className?: string
}

export function MessagingConversationItem({
  conversation,
  isSelected = false,
  onSelect,
  trailing,
  className,
}: MessagingConversationItemProps) {
  const hasUnread = (conversation.unreadCount ?? 0) > 0
  const initials = getInitials(conversation.displayName)
  const relativeTime = formatRelativeTime(conversation.lastMessageAt)

  return (
    <button
      type="button"
      className={cn(
        "flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-md p-2 text-left transition-colors hover:bg-muted",
        isSelected && "bg-muted",
        className
      )}
      onClick={() => onSelect?.(conversation.id)}
    >
      <div className="relative shrink-0">
        <Avatar className="size-10">
          {conversation.avatarUrl ? (
            <AvatarImage src={conversation.avatarUrl} alt={conversation.displayName} />
          ) : null}
          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
        {hasUnread ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-semantic-success"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm text-foreground",
              hasUnread ? "font-semibold" : "font-medium"
            )}
          >
            {conversation.displayName}
          </span>
          {relativeTime ? (
            <span
              className={cn(
                "shrink-0 text-xs",
                hasUnread ? "font-medium text-semantic-success" : "text-muted-foreground"
              )}
            >
              {relativeTime}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {conversation.lastMessagePreview ?? ""}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {trailing}
            {hasUnread ? (
              <span
                className="flex size-5 min-w-5 items-center justify-center rounded-full bg-semantic-success px-1 text-[10px] font-semibold text-primary-foreground"
                aria-label={`${conversation.unreadCount} não lida(s)`}
              >
                {(conversation.unreadCount ?? 0) > 99 ? "99+" : conversation.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}
