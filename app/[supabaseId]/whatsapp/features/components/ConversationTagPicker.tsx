"use client"

import { useMemo, useState } from "react"
import { Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { whatsAppTagBadgeClassName } from "@/lib/whatsapp/tag-colors"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppConversation } from "../context/WhatsAppInboxTypes"

interface ConversationTagPickerProps {
  conversation: WhatsAppConversation
}

export function ConversationTagPicker({ conversation }: ConversationTagPickerProps) {
  const { teamTags, setConversationTags, isUpdatingTags } = useWhatsAppInboxContext()
  const [open, setOpen] = useState(false)
  const [draftTagIds, setDraftTagIds] = useState<string[]>([])

  const selectedIds = useMemo(
    () => new Set(conversation.tags?.map((tag) => tag.id) ?? []),
    [conversation.tags]
  )

  const openPicker = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftTagIds(conversation.tags?.map((tag) => tag.id) ?? [])
    }
    setOpen(nextOpen)
  }

  const toggleDraftTag = (tagId: string) => {
    setDraftTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const saveTags = async () => {
    await setConversationTags(conversation.id, draftTagIds)
    setOpen(false)
  }

  if (teamTags.length === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isUpdatingTags}>
          <Tag data-icon="inline-start" />
          Tags
          {selectedIds.size > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {selectedIds.size}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Tags da conversa</p>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {teamTags.map((tag) => (
              <label key={tag.id} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={draftTagIds.includes(tag.id)}
                  onCheckedChange={() => toggleDraftTag(tag.id)}
                />
                <Badge
                  variant="outline"
                  className={cn("font-normal", whatsAppTagBadgeClassName(tag.color))}
                >
                  {tag.name}
                </Badge>
              </label>
            ))}
          </div>
          <Button size="sm" onClick={() => void saveTags()} disabled={isUpdatingTags}>
            Salvar tags
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
