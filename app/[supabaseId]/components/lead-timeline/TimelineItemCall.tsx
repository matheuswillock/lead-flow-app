import { Phone } from "lucide-react"
import { TimelineItemNote } from "./TimelineItemNote"

type TimelineItemCallProps = {
  body?: string | null
  mentionRegex: RegExp | null
}

export function TimelineItemCall({ body, mentionRegex }: TimelineItemCallProps) {
  return <TimelineItemNote body={body} mentionRegex={mentionRegex} />
}

export function callTimelineIcon() {
  return <Phone className="size-4 text-primary" />
}
