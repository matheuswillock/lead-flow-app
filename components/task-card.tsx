"use client"

import * as React from "react"
import { toast } from "sonner"
import { MoreVertical, Loader2, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatIntimezone } from "@/lib/dates"

type TaskAssigneeStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELED" | "OVERDUE"

type TaskAssignee = {
  id: string
  taskId: string
  profileId: string
  status: TaskAssigneeStatus
  googleSynced: boolean
  googleEventId: string | null
  profile: {
    id: string
    fullName: string | null
    email: string
    profileIconUrl: string | null
  }
}

export type TaskItem = {
  id: string
  leadId: string
  body: string
  isUrgent: boolean
  startAt: string | null
  endAt: string | null
  createdBy: string
  createdAt: string
  creator: {
    id: string
    fullName: string | null
    email: string
    profileIconUrl: string | null
  }
  lead: {
    id: string
    name: string
    leadCode: string
  }
  assignees: TaskAssignee[]
}

interface TaskCardProps {
  task: TaskItem
  currentProfileId: string
  supabaseId: string
  activeTeamId: string
  tz: string
  onStatusUpdated?: () => void
  onCanceled?: () => void
}

const STATUS_LABELS: Record<TaskAssigneeStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em progresso",
  DONE: "Concluída",
  CANCELED: "Cancelada",
  OVERDUE: "Vencida",
}

const NEXT_STATUS_OPTIONS: Partial<Record<TaskAssigneeStatus, TaskAssigneeStatus[]>> = {
  PENDING: ["IN_PROGRESS", "DONE"],
  IN_PROGRESS: ["DONE", "PENDING"],
  OVERDUE: ["IN_PROGRESS", "DONE"],
}

const getInitials = (name?: string | null) => {
  const safeName = name?.trim() || ""
  if (!safeName) return "?"
  const words = safeName.split(" ").filter(Boolean)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
}

const deriveOverallStatus = (assignees: TaskAssignee[]): TaskAssigneeStatus => {
  if (assignees.length === 0) return "PENDING"
  const statuses = assignees.map((a) => a.status)
  if (statuses.every((s) => s === "DONE")) return "DONE"
  if (statuses.every((s) => s === "CANCELED")) return "CANCELED"
  if (statuses.some((s) => s === "OVERDUE")) return "OVERDUE"
  if (statuses.some((s) => s === "IN_PROGRESS")) return "IN_PROGRESS"
  return "PENDING"
}

export function TaskCard({
  task,
  currentProfileId,
  supabaseId,
  activeTeamId,
  tz,
  onStatusUpdated,
  onCanceled,
}: TaskCardProps) {
  const [updatingStatus, setUpdatingStatus] = React.useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [canceling, setCanceling] = React.useState(false)

  const isCreator = task.createdBy === currentProfileId
  const myAssignee = task.assignees.find((a) => a.profileId === currentProfileId)
  const overallStatus = deriveOverallStatus(task.assignees)

  const now = new Date()
  const endAt = task.endAt ? new Date(task.endAt) : null
  const isOverdue =
    endAt && endAt < now && overallStatus !== "DONE" && overallStatus !== "CANCELED"

  const handleUpdateMyStatus = async (status: TaskAssigneeStatus) => {
    if (!myAssignee) return
    setUpdatingStatus(true)
    try {
      const response = await fetch(
        `/api/v1/tasks/${task.id}/assignees/${currentProfileId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({ status }),
        }
      )
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao atualizar status.")
      }
      toast.success("Status atualizado!")
      onStatusUpdated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}/cancel`, {
        method: "POST",
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao cancelar tarefa.")
      }
      toast.success("Tarefa cancelada.")
      setCancelDialogOpen(false)
      onCanceled?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar tarefa.")
    } finally {
      setCanceling(false)
    }
  }

  const nextStatuses = myAssignee ? (NEXT_STATUS_OPTIONS[myAssignee.status] ?? []) : []

  return (
    <>
      <Card
        className={cn(
          "relative border-l-4 shadow-none transition-all",
          task.isUrgent ? "border-l-warning" : "border-l-primary",
          isOverdue && "animate-pulse [animation-duration:2s] motion-reduce:animate-none",
          overallStatus === "CANCELED" && "opacity-60",
          overallStatus === "DONE" && "opacity-75"
        )}
      >
        <CardContent className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {task.isUrgent && (
                <Badge variant="destructive" className="w-fit">
                  Urgente
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="gap-1">
                  <Clock className="size-3" />
                  Vencida
                </Badge>
              )}
              {overallStatus === "DONE" && (
                <Badge variant="secondary">Concluída</Badge>
              )}
              {overallStatus === "CANCELED" && (
                <Badge variant="secondary">Cancelada</Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={updatingStatus || canceling}
                >
                  {updatingStatus ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MoreVertical className="size-4" />
                  )}
                  <span className="sr-only">Ações da tarefa</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {myAssignee && nextStatuses.length > 0 && (
                  <>
                    {nextStatuses.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => handleUpdateMyStatus(s)}>
                        Marcar como: {STATUS_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                    {isCreator && <DropdownMenuSeparator />}
                  </>
                )}
                {isCreator && overallStatus !== "CANCELED" && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setCancelDialogOpen(true)}
                  >
                    Cancelar tarefa
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm font-medium leading-snug">{task.body}</p>

          {myAssignee && myAssignee.status !== "DONE" && myAssignee.status !== "CANCELED" && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={updatingStatus || canceling}
                onClick={() => handleUpdateMyStatus("DONE")}
              >
                {updatingStatus ? <Loader2 className="size-4 animate-spin" /> : "Concluído"}
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Lead: {task.lead.name}{" "}
            <span className="opacity-60">· {task.lead.leadCode}</span>
          </div>

          {(task.startAt || task.endAt) && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {task.startAt
                ? formatIntimezone(new Date(task.startAt), "dd/MM HH:mm", tz)
                : "—"}
              {" → "}
              {task.endAt
                ? formatIntimezone(new Date(task.endAt), "dd/MM HH:mm", tz)
                : "—"}
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Responsáveis</span>
            <div className="flex flex-wrap gap-2">
              {task.assignees.map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center gap-1.5"
                  title={`${assignee.profile.fullName ?? assignee.profile.email} — ${STATUS_LABELS[assignee.status]}`}
                >
                  <Avatar className="size-6">
                    <AvatarImage src={assignee.profile.profileIconUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(assignee.profile.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs truncate max-w-[100px]">
                    {assignee.profile.fullName ?? assignee.profile.email.split("@")[0]}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      assignee.status === "DONE" && "border-green-500 text-green-600",
                      assignee.status === "OVERDUE" && "border-destructive text-destructive",
                      assignee.status === "IN_PROGRESS" && "border-primary text-primary",
                      assignee.status === "CANCELED" && "opacity-50"
                    )}
                  >
                    {STATUS_LABELS[assignee.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancelará a tarefa para todos os responsáveis. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancelar tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
