"use client"

import { useMemo, useState, type MutableRefObject } from "react"
import type { LeadActivityReactionSummary, LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Calendar, MessageSquare } from "lucide-react"
import {
  TimelineActivityReactions,
} from "./TimelineActivityReactions"
import { TimelineItemShell } from "./TimelineItemShell"
import { TimelineItemNote } from "./TimelineItemNote"
import {
  TimelineItemStatusChange,
  statusChangeTimelineIcon,
} from "./TimelineItemStatusChange"
import { TimelineItemTask, taskTimelineIcon } from "./TimelineItemTask"
import { TimelineItemWhatsApp, whatsappTimelineIcon } from "./TimelineItemWhatsApp"
import { TimelineItemEmail, emailTimelineIcon } from "./TimelineItemEmail"
import { TimelineItemStudioBot, studioBotTimelineIcon } from "./TimelineItemStudioBot"
import { TimelineItemCall, callTimelineIcon } from "./TimelineItemCall"
import {
  activityMatchesFilter,
  isScheduleActivity,
  TIMELINE_FILTER_OPTIONS,
  type TimelineFilterValue,
} from "./timeline-utils"
import { useDragScroll } from "./useDragScroll"

type LeadActivityTimelineProps = {
  activities: LeadActivityResponseDTO[]
  supabaseId: string
  scheduleTimezone: string
  highlightedActivityId: string | null
  activityItemRefs: MutableRefObject<Map<string, HTMLDivElement>>
  canReactToActivity: boolean
  reactionPickerOpenId: string | null
  onReactionPickerOpenChange: (activityId: string | null) => void
  onToggleReaction: (activityId: string, emoji: string, unified: string) => void
  getReactionsForActivity: (activityId: string) => LeadActivityReactionSummary[]
  mentionRegex: RegExp | null
}

function resolveTypeIcon(activity: LeadActivityResponseDTO) {
  if (isScheduleActivity(activity)) {
    return <Calendar className="size-4 text-primary" />
  }

  switch (activity.type) {
    case "call":
      return callTimelineIcon()
    case "whatsapp":
      return whatsappTimelineIcon()
    case "email":
      return emailTimelineIcon()
    case "status_change":
      return statusChangeTimelineIcon()
    case "task":
      return taskTimelineIcon()
    case "studio_bot":
      return studioBotTimelineIcon()
    case "note":
    default:
      return <MessageSquare className="size-4 text-primary" />
  }
}

function resolveTypeLabel(activity: LeadActivityResponseDTO): string {
  if (isScheduleActivity(activity)) return "Agendamento"
  switch (activity.type) {
    case "call":
      return "Ligação"
    case "whatsapp":
      return "WhatsApp"
    case "email":
      return "E-mail"
    case "status_change":
      return "Status"
    case "task":
      return "Tarefa"
    case "studio_bot":
      return "Studio Bot"
    case "note":
    default:
      return "Comentário"
  }
}

function renderTimelineContent(
  activity: LeadActivityResponseDTO,
  supabaseId: string,
  mentionRegex: RegExp | null
) {
  if (activity.type === "task") {
    return (
      <TimelineItemTask
        body={activity.body}
        payload={activity.payload}
        mentionRegex={mentionRegex}
      />
    )
  }

  if (activity.type === "status_change") {
    return (
      <TimelineItemStatusChange
        body={activity.body}
        payload={activity.payload}
        mentionRegex={mentionRegex}
      />
    )
  }

  if (activity.type === "whatsapp") {
    return (
      <TimelineItemWhatsApp
        body={activity.body}
        payload={activity.payload}
        supabaseId={supabaseId}
        mentionRegex={mentionRegex}
      />
    )
  }

  if (activity.type === "email") {
    return (
      <TimelineItemEmail
        body={activity.body}
        payload={activity.payload}
        mentionRegex={mentionRegex}
      />
    )
  }

  if (activity.type === "studio_bot") {
    return <TimelineItemStudioBot body={activity.body} mentionRegex={mentionRegex} />
  }

  if (activity.type === "call") {
    return <TimelineItemCall body={activity.body} mentionRegex={mentionRegex} />
  }

  return <TimelineItemNote body={activity.body} mentionRegex={mentionRegex} />
}

export function LeadActivityTimeline({
  activities,
  supabaseId,
  scheduleTimezone,
  highlightedActivityId,
  activityItemRefs,
  canReactToActivity,
  reactionPickerOpenId,
  onReactionPickerOpenChange,
  onToggleReaction,
  getReactionsForActivity,
  mentionRegex,
}: LeadActivityTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<TimelineFilterValue>("all")
  const chipsDragScroll = useDragScroll<HTMLDivElement>()

  const filteredActivities = useMemo(
    () => activities.filter((activity) => activityMatchesFilter(activity, typeFilter)),
    [activities, typeFilter]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ToggleGroup
        type="single"
        value={typeFilter}
        onValueChange={(value) => {
          if (value) setTypeFilter(value as TimelineFilterValue)
        }}
        variant="outline"
        size="sm"
        {...chipsDragScroll}
        className="activity-scrollbar flex w-full shrink-0 flex-nowrap cursor-grab select-none justify-start gap-1 overflow-x-auto pb-1 active:cursor-grabbing"
      >
        {TIMELINE_FILTER_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="shrink-0 whitespace-nowrap text-xs data-[state=on]:border-primary/40 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="activity-scrollbar min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="flex flex-col gap-3">
          {filteredActivities.length === 0 ? (
            <div className="w-full rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              Nenhuma atividade registrada.
            </div>
          ) : (
            filteredActivities.map((activity) => {
              const reactions = getReactionsForActivity(activity.id)
              return (
                <TimelineItemShell
                  key={activity.id}
                  activity={activity}
                  scheduleTimezone={scheduleTimezone}
                  highlighted={highlightedActivityId === activity.id}
                  typeIcon={resolveTypeIcon(activity)}
                  typeLabel={resolveTypeLabel(activity)}
                  itemRef={(node) => {
                    if (node) {
                      activityItemRefs.current.set(activity.id, node)
                    } else {
                      activityItemRefs.current.delete(activity.id)
                    }
                  }}
                  footer={
                    <TimelineActivityReactions
                      activityId={activity.id}
                      reactions={reactions}
                      canReact={canReactToActivity}
                      pickerOpen={reactionPickerOpenId === activity.id}
                      onPickerOpenChange={(open) =>
                        onReactionPickerOpenChange(open ? activity.id : null)
                      }
                      onToggleReaction={onToggleReaction}
                    />
                  }
                >
                  {renderTimelineContent(activity, supabaseId, mentionRegex)}
                </TimelineItemShell>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
