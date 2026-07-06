import type { ReactNode } from "react"
import { renderActivityBodyWithMentions } from "./TimelineActivityReactions"

type TimelineItemNoteProps = {
  body?: string | null
  mentionRegex: RegExp | null
}

export function TimelineItemNote({ body, mentionRegex }: TimelineItemNoteProps) {
  if (!body) return null
  return (
    <p className="col-span-2 whitespace-pre-line wrap-break-word text-sm text-muted-foreground">
      {renderActivityBodyWithMentions(body, mentionRegex)}
    </p>
  )
}

export function TimelineItemBody({ children }: { children: ReactNode }) {
  return (
    <p className="col-span-2 whitespace-pre-line wrap-break-word text-sm text-muted-foreground">
      {children}
    </p>
  )
}
