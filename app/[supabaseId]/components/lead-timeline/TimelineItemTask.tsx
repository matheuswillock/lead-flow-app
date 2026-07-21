import { Badge } from "@/components/ui/badge"
import { ClipboardList } from "lucide-react"
import { renderActivityBodyWithMentions } from "./TimelineActivityReactions"

type TaskPayload = {
  kind?: string
  title?: string
  status?: string
  isUrgent?: boolean
  assigneeMentions?: Array<{ profileId?: string; label?: string }>
}

type TimelineItemTaskProps = {
  body?: string | null
  payload?: unknown
  mentionRegex: RegExp | null
}

export function TimelineItemTask({ body, payload, mentionRegex }: TimelineItemTaskProps) {
  const taskPayload = payload && typeof payload === "object" ? (payload as TaskPayload) : null
  const taskTitle = taskPayload?.title?.trim() || "Sem título"
  const isTaskStatusUpdate = taskPayload?.kind === "task_status_update"
  const taskMentions = (taskPayload?.assigneeMentions ?? [])
    .map((entry) => entry?.label?.trim())
    .map((value) => (value && !value.startsWith("@") ? `@${value}` : value))
    .filter((value): value is string => Boolean(value))
  const taskAssignedText =
    taskMentions.length > 0
      ? `Nova task atribuída para ${taskMentions.join(", ")}`
      : "Nova task atribuída"
  const taskStatusText =
    taskPayload?.status === "DONE" ? "Task concluída" : "Status da task atualizado"
  const taskHeaderText = isTaskStatusUpdate ? taskStatusText : taskAssignedText

  return (
    <div className="col-span-2 flex flex-col gap-1">
      <p className="text-xs font-medium text-primary">{taskHeaderText}</p>
      <p className="text-sm font-semibold text-foreground">{taskTitle}</p>
      {taskPayload?.isUrgent ? (
        <Badge variant="destructive" className="w-fit">
          Urgente
        </Badge>
      ) : null}
      {body ? (
        <p className="whitespace-pre-line wrap-break-word text-sm text-muted-foreground">
          {renderActivityBodyWithMentions(body, mentionRegex)}
        </p>
      ) : null}
    </div>
  )
}

export function taskTimelineIcon() {
  return <ClipboardList className="size-4 text-primary" />
}
