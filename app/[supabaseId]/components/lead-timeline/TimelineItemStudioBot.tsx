import { Bot } from "lucide-react"
import { TimelineItemNote } from "./TimelineItemNote"

type TimelineItemStudioBotProps = {
  body?: string | null
  mentionRegex: RegExp | null
}

export function TimelineItemStudioBot({ body, mentionRegex }: TimelineItemStudioBotProps) {
  return <TimelineItemNote body={body} mentionRegex={mentionRegex} />
}

export function studioBotTimelineIcon() {
  return <Bot className="size-4 text-primary" />
}
