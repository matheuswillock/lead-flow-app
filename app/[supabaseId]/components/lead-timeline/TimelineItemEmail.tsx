import { Mail } from "lucide-react"
import { renderActivityBodyWithMentions } from "./TimelineActivityReactions"

type EmailPayload = {
  subject?: string
  campaignId?: string
  campaignName?: string
}

type TimelineItemEmailProps = {
  body?: string | null
  payload?: unknown
  mentionRegex: RegExp | null
}

export function TimelineItemEmail({ body, payload, mentionRegex }: TimelineItemEmailProps) {
  const emailPayload = payload && typeof payload === "object" ? (payload as EmailPayload) : null
  const subject = emailPayload?.subject?.trim()
  const campaignName = emailPayload?.campaignName?.trim()
  const campaignLabel = campaignName || (emailPayload?.campaignId ? "Campanha de e-mail" : null)

  return (
    <div className="col-span-2 flex flex-col gap-1">
      {subject ? <p className="text-sm font-medium text-foreground">{subject}</p> : null}
      {body ? (
        <p className="whitespace-pre-line wrap-break-word text-sm text-muted-foreground">
          {renderActivityBodyWithMentions(body, mentionRegex)}
        </p>
      ) : null}
      {campaignLabel ? (
        <p className="text-xs text-muted-foreground">{campaignLabel}</p>
      ) : null}
    </div>
  )
}

export function emailTimelineIcon() {
  return <Mail className="size-4 text-primary" />
}
