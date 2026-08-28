"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CircleAlert, CircleCheck, CircleDashed, FileText, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  RADAR_PROFILE_FORM_COMPLETION,
  type RadarProfileFormCompletionStatus,
  type RadarProfileFormItem,
} from "@/lib/radar/profile-forms"

const COMPLETION_BADGE: Record<
  RadarProfileFormCompletionStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  [RADAR_PROFILE_FORM_COMPLETION.complete]: {
    label: "Completo",
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
    icon: CircleCheck,
  },
  [RADAR_PROFILE_FORM_COMPLETION.incomplete]: {
    label: "Incompleto",
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    icon: CircleDashed,
  },
  [RADAR_PROFILE_FORM_COMPLETION.startedWithoutAnswers]: {
    label: "Iniciou sem nenhuma resposta",
    className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    icon: CircleAlert,
  },
}

function RadarProfileFormCompletionBadge({
  status,
}: {
  status: RadarProfileFormCompletionStatus
}) {
  const config = COMPLETION_BADGE[status]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={cn("w-fit shrink-0 gap-1 text-xs", config.className)}>
      <Icon data-icon="inline-start" />
      {config.label}
    </Badge>
  )
}

function formatInteractionDate(value: string): string {
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR })
}

type RadarProfileFormsTabProps = {
  items: RadarProfileFormItem[] | null
  isLoading: boolean
}

export function RadarProfileFormsTab({ items, isLoading }: RadarProfileFormsTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum formulário iniciado por este perfil.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Formulários</p>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.formId} className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="font-medium">{item.name}</p>
              </div>
              <RadarProfileFormCompletionBadge status={item.completionStatus} />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.answeredQuestionCount}{" "}
              {item.answeredQuestionCount === 1 ? "pergunta respondida" : "perguntas respondidas"}
            </p>
            <p className="text-xs text-muted-foreground">
              Primeiro: {formatInteractionDate(item.firstInteractionAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Último: {formatInteractionDate(item.lastInteractionAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
