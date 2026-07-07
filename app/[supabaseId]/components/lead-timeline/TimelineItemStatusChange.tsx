import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft } from "lucide-react"
import { renderActivityBodyWithMentions } from "./TimelineActivityReactions"

type StatusChangePayload = {
  fromLabel?: string
  toLabel?: string
  from?: string
  to?: string
}

type TimelineItemStatusChangeProps = {
  body?: string | null
  payload?: unknown
  mentionRegex: RegExp | null
}

export function TimelineItemStatusChange({
  body,
  payload,
  mentionRegex,
}: TimelineItemStatusChangeProps) {
  const statusPayload =
    payload && typeof payload === "object" ? (payload as StatusChangePayload) : null
  const fromLabel = statusPayload?.fromLabel || statusPayload?.from || "—"
  const toLabel = statusPayload?.toLabel || statusPayload?.to || "—"

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{fromLabel}</Badge>
        <ArrowRightLeft className="size-3.5 text-muted-foreground" />
        <Badge variant="secondary">{toLabel}</Badge>
      </div>
      {body ? (
        <p className="whitespace-pre-line wrap-break-word text-sm text-muted-foreground">
          {renderActivityBodyWithMentions(body, mentionRegex)}
        </p>
      ) : null}
    </div>
  )
}

export function statusChangeTimelineIcon() {
  return <ArrowRightLeft className="size-4 text-primary" />
}
