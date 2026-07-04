"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { whatsAppTagBadgeClassName } from "@/lib/whatsapp/tag-colors"
import type { WhatsAppConversationTag } from "../context/WhatsAppInboxTypes"

interface ConversationTagBadgesProps {
  tags?: WhatsAppConversationTag[]
  className?: string
  maxVisible?: number
}

export function ConversationTagBadges({ tags, className, maxVisible = 2 }: ConversationTagBadgesProps) {
  if (!tags || tags.length === 0) return null

  const visible = tags.slice(0, maxVisible)
  const hiddenCount = tags.length - visible.length

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn("h-4 px-1.5 text-[10px] font-normal", whatsAppTagBadgeClassName(tag.color))}
        >
          {tag.name}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
          +{hiddenCount}
        </Badge>
      ) : null}
    </div>
  )
}
