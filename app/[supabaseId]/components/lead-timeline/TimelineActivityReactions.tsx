import type { ReactNode } from "react"
import type { LeadActivityReactionSummary } from "@/app/api/v1/leads/DTO/leadResponseDTO"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Smile } from "lucide-react"
import dynamic from "next/dynamic"
import { EmojiStyle, Theme } from "emoji-picker-react"

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })

type EmojiPickerData = {
  emoji: string
  unified: string
}

const DEFAULT_REACTION_UNIFIEDS = ["1f44d", "2764-fe0f", "1f602", "1f389", "1f62e", "1f622"]

type TimelineActivityReactionsProps = {
  activityId: string
  reactions: LeadActivityReactionSummary[]
  canReact: boolean
  pickerOpen: boolean
  onPickerOpenChange: (open: boolean) => void
  onToggleReaction: (activityId: string, emoji: string, unified: string) => void
}

export function TimelineActivityReactions({
  activityId,
  reactions,
  canReact,
  pickerOpen,
  onPickerOpenChange,
  onToggleReaction,
}: TimelineActivityReactionsProps) {
  if (reactions.length === 0 && !canReact) return null

  return (
    <div className="col-span-2 flex flex-wrap items-center gap-2">
      {reactions.map((reaction) => (
        <button
          key={`${activityId}-${reaction.unified}`}
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
            reaction.reactedByMe
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onToggleReaction(activityId, reaction.emoji, reaction.unified)}
          disabled={!canReact}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
      {canReact ? (
        <Popover open={pickerOpen} onOpenChange={onPickerOpenChange}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
              <Smile data-icon="inline-start" />
              Reagir
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" side="top">
            <EmojiPicker
              onEmojiClick={(emojiData: EmojiPickerData) => {
                if (!emojiData?.emoji || !emojiData?.unified) return
                onToggleReaction(activityId, emojiData.emoji, emojiData.unified)
                onPickerOpenChange(false)
              }}
              reactionsDefaultOpen
              reactions={DEFAULT_REACTION_UNIFIEDS}
              emojiStyle={EmojiStyle.NATIVE}
              theme={Theme.DARK}
              lazyLoadEmojis
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

export function renderActivityBodyWithMentions(
  body: string,
  mentionRegex: RegExp | null
): ReactNode {
  if (!mentionRegex) return body
  const regex = new RegExp(mentionRegex.source, mentionRegex.flags)
  const parts: ReactNode[] = []
  let lastIndex = 0
  for (const match of body.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push(body.slice(lastIndex, index))
    }
    parts.push(
      <span key={`${index}-${match[0]}`} className="font-medium text-primary">
        {match[0]}
      </span>
    )
    lastIndex = index + match[0].length
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex))
  }
  return parts.length > 0 ? parts : body
}
