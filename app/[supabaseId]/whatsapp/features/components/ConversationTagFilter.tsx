"use client"

import { Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { whatsAppTagBadgeClassName } from "@/lib/whatsapp/tag-colors"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"

export function ConversationTagFilter() {
  const { teamTags, filterTagIds, setFilterTagIds, isLoadingTags } = useWhatsAppInboxContext()

  if (isLoadingTags || teamTags.length === 0) {
    return null
  }

  const toggleTag = (tagId: string) => {
    if (filterTagIds.includes(tagId)) {
      setFilterTagIds(filterTagIds.filter((id) => id !== tagId))
      return
    }
    setFilterTagIds([...filterTagIds, tagId])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Tag data-icon="inline-start" />
          Tags
          {filterTagIds.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {filterTagIds.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => setFilterTagIds([])}
            disabled={filterTagIds.length === 0}
          >
            Limpar filtro
          </Button>
          {teamTags.map((tag) => {
            const selected = filterTagIds.includes(tag.id)
            return (
              <Button
                key={tag.id}
                variant={selected ? "secondary" : "ghost"}
                size="sm"
                className="justify-start gap-2"
                onClick={() => toggleTag(tag.id)}
              >
                <Badge
                  variant="outline"
                  className={cn("font-normal", whatsAppTagBadgeClassName(tag.color))}
                >
                  {tag.name}
                </Badge>
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
