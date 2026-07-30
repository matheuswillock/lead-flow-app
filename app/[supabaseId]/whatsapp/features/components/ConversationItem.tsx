"use client"

import { memo } from "react"
import { Link2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessagingConversationItem } from "@/components/messaging/MessagingConversationItem"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import { useUserContext } from "@/app/context/UserContext"
import { mapWhatsAppConversationToMessaging } from "../utils/mapWhatsAppToMessaging"
import { ConversationTagBadges } from "./ConversationTagBadges"
import type { WhatsAppConversation } from "../context/WhatsAppInboxTypes"

interface ConversationItemProps {
  conversation: WhatsAppConversation
}

function getAssignedMemberInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

function ConversationItemInner({ conversation }: ConversationItemProps) {
  const { selectedConversationId, selectConversation, teamMembers } = useWhatsAppInboxContext()
  const { user } = useUserContext()

  const assignedMember = conversation.assignedProfileId
    ? teamMembers.find((m) => m.id === conversation.assignedProfileId)
    : null

  return (
    <MessagingConversationItem
      conversation={mapWhatsAppConversationToMessaging(conversation)}
      isSelected={selectedConversationId === conversation.id}
      onSelect={selectConversation}
      trailing={
        <>
          <ConversationTagBadges tags={conversation.tags} className="max-w-24" />
          {conversation.leadId ? (
            <Link2 className="size-3 text-primary" aria-label="Lead vinculado" />
          ) : null}
          {conversation.assignedProfileId ? (
            conversation.assignedProfileId === user?.id ? (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                Você
              </Badge>
            ) : assignedMember ? (
              <Avatar className="size-5" title={assignedMember.name}>
                <AvatarFallback className="bg-muted text-[8px] font-medium text-muted-foreground">
                  {getAssignedMemberInitials(assignedMember.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                Atribuída
              </Badge>
            )
          ) : null}
        </>
      }
    />
  )
}

export const ConversationItem = memo(
  ConversationItemInner,
  (prev, next) =>
    prev.conversation.id === next.conversation.id &&
    prev.conversation.lastMessageAt === next.conversation.lastMessageAt &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.assignedProfileId === next.conversation.assignedProfileId &&
    prev.conversation.handoffMode === next.conversation.handoffMode &&
    prev.conversation.tags?.length === next.conversation.tags?.length,
)
