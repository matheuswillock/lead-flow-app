"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Phone, FileText, Mail, FileSignature, MessageCircle, CalendarClock, MoreHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO"
import { compareInTz, detectBrowserTimezone } from "@/lib/dates"

type TaskGoogleSyncResult = {
  profileId: string
  googleSynced: boolean
  googleEventId: string | null
  reason?: string
}

export type TaskCreatedPayload = {
  taskId: string
  activityId: string
  googleSync: TaskGoogleSyncResult[]
}

type TaskFormInitialData = {
  taskId: string
  title: string
  taskType: TaskTypeValue
  body: string
  isUrgent: boolean
  startAt: string | null
  endAt: string | null
  assigneeProfileIds: string[]
}

const TASK_TYPE_OPTIONS = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "documentation", label: "Documentação", icon: FileText },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "proposal", label: "Proposta", icon: FileSignature },
  { value: "whatsapp", label: "Whatsapp", icon: MessageCircle },
  { value: "meeting", label: "Reunião", icon: CalendarClock },
  { value: "other", label: "Outros", icon: MoreHorizontal },
] as const

type TaskTypeValue = typeof TASK_TYPE_OPTIONS[number]["value"]

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  leadName: string
  teamMembers: UserAssociated[]
  supabaseId: string
  activeTeamId: string
  onSuccess?: (payload: TaskCreatedPayload) => void
  initialData?: TaskFormInitialData | null
}

const getInitials = (name?: string | null) => {
  const safeName = name?.trim() || ""
  if (!safeName) return "?"
  const words = safeName.split(" ").filter(Boolean)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
}

export function TaskFormDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  teamMembers,
  supabaseId,
  activeTeamId,
  onSuccess,
  initialData,
}: TaskFormDialogProps) {
  const [title, setTitle] = React.useState("")
  const [taskType, setTaskType] = React.useState<TaskTypeValue | "">("")
  const [body, setBody] = React.useState("")
  const [isUrgent, setIsUrgent] = React.useState(false)
  const [startAt, setStartAt] = React.useState<Date | undefined>(undefined)
  const [endAt, setEndAt] = React.useState<Date | undefined>(undefined)
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const browserTz = React.useMemo(() => detectBrowserTimezone(), [])

  const selectedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id))
  const unselectedMembers = teamMembers.filter((m) => !assigneeIds.includes(m.id))

  const handleAddAssignee = (memberId: string) => {
    if (!memberId || assigneeIds.includes(memberId)) return
    setAssigneeIds((prev) => [...prev, memberId])
  }

  const handleRemoveAssignee = (memberId: string) => {
    setAssigneeIds((prev) => prev.filter((id) => id !== memberId))
  }

  const handleReset = () => {
    setTitle("")
    setTaskType("")
    setBody("")
    setIsUrgent(false)
    setStartAt(undefined)
    setEndAt(undefined)
    setAssigneeIds([])
  }

  React.useEffect(() => {
    if (!open) return
    if (!initialData) {
      handleReset()
      return
    }
    setTitle(initialData.title)
    setTaskType(initialData.taskType)
    setBody(initialData.body)
    setIsUrgent(initialData.isUrgent)
    setStartAt(initialData.startAt ? new Date(initialData.startAt) : undefined)
    setEndAt(initialData.endAt ? new Date(initialData.endAt) : undefined)
    setAssigneeIds(initialData.assigneeProfileIds)
  }, [open, initialData])

  const isFormValid = title.trim().length > 0 && taskType !== "" && body.trim().length > 0 && assigneeIds.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Título da tarefa é obrigatório.")
      return
    }
    if (!taskType) {
      toast.error("Selecione o tipo da tarefa.")
      return
    }
    if (!body.trim()) {
      toast.error("Descrição da tarefa é obrigatória.")
      return
    }
    if (assigneeIds.length === 0) {
      toast.error("Selecione ao menos um responsável.")
      return
    }
    if (startAt && endAt && compareInTz(endAt, startAt, browserTz, "minute") < 0) {
      toast.error("A data de fim não pode ser anterior ao início.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        type: "task",
        title: title.trim(),
        taskType,
        body: body.trim(),
        isUrgent,
        assigneeProfileIds: assigneeIds,
      }
      if (startAt) payload.startAt = startAt.toISOString()
      if (endAt) payload.endAt = endAt.toISOString()

      const response = await fetch(
        initialData?.taskId ? `/api/v1/tasks/${initialData.taskId}` : `/api/v1/leads/${leadId}/activities`,
        {
        method: initialData?.taskId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao criar tarefa.")
      }

      const notSynced: TaskGoogleSyncResult[] = (result.result?.googleSync ?? []).filter(
        (r: TaskGoogleSyncResult) => !r.googleSynced
      )

      toast.success(initialData?.taskId ? "Tarefa atualizada com sucesso!" : "Tarefa criada com sucesso!")
      if (notSynced.length > 0) {
        toast.info(
          `${notSynced.length} responsável(is) sem Google Calendar conectado — tarefa criada internamente.`
        )
      }

      onSuccess?.({
        taskId: result.result?.task?.id ?? initialData?.taskId ?? "",
        activityId: result.result?.activity?.id ?? "",
        googleSync: result.result?.googleSync ?? [],
      })

      handleReset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tarefa.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) { handleReset(); onOpenChange(next) } }}>
      <DialogContent hideClose className="max-h-[90vh] flex flex-col sm:max-w-130">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>{initialData?.taskId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
              <DialogDescription>Lead: {leadName}</DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id="task-urgent"
                checked={isUrgent}
                onCheckedChange={setIsUrgent}
                disabled={isSubmitting}
              />
              <Label htmlFor="task-urgent" className="cursor-pointer text-sm">
                Urgente
              </Label>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 dialog-scrollbar pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-type">Tipo *</Label>
            <Select
              value={taskType}
              onValueChange={(v) => setTaskType(v as TaskTypeValue)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="task-type" className="w-full" aria-required>
                {taskType ? (() => {
                  const selected = TASK_TYPE_OPTIONS.find((o) => o.value === taskType)
                  if (!selected) return <SelectValue placeholder="Selecione o tipo..." />
                  const Icon = selected.icon
                  return (
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{selected.label}</span>
                    </div>
                  )
                })() : <SelectValue placeholder="Selecione o tipo..." />}
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <SelectItem key={opt.value} value={opt.value} className="items-center">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-body">Descrição *</Label>
            <Textarea
              id="task-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Descreva o que precisa ser feito..."
              rows={3}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-assignee">Responsáveis *</Label>
            <Select
              value=""
              onValueChange={handleAddAssignee}
              disabled={isSubmitting || unselectedMembers.length === 0}
            >
              <SelectTrigger id="task-assignee" className="w-full py-1.5" aria-required>
                {selectedMembers.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pr-6">
                    {selectedMembers.map((m) => (
                      <Badge key={m.id} variant="secondary" className="gap-1.5 pl-1 pr-1 max-w-full">
                        <Avatar className="size-4">
                          <AvatarImage src={m.avatarImageUrl} />
                          <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.name || m.email}</span>
                        <span
                          role="button"
                          tabIndex={isSubmitting ? -1 : 0}
                          className="rounded-full hover:text-destructive focus:outline-none"
                          onPointerDown={(e) => {
                            if (isSubmitting) return
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveAssignee(m.id)
                          }}
                          onKeyDown={(e) => {
                            if (isSubmitting) return
                            if (e.key !== "Enter" && e.key !== " ") return
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveAssignee(m.id)
                          }}
                          aria-label={`Remover responsável ${m.name || m.email}`}
                          data-disabled={isSubmitting ? "true" : undefined}
                        >
                          <X className="size-3" />
                        </span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <SelectValue placeholder={
                    unselectedMembers.length === 0
                      ? "Todos os membros selecionados"
                      : "Adicionar responsável..."
                  } />
                )}
              </SelectTrigger>
              <SelectContent>
                {unselectedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="size-5 shrink-0">
                        <AvatarImage src={member.avatarImageUrl} />
                        <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{member.name || member.email}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <DateTimePicker
              label="Início"
              date={startAt}
              onDateChange={setStartAt}
              disabled={isSubmitting}
              disablePastDates={false}
            />
            <DateTimePicker
              label="Fim"
              date={endAt}
              onDateChange={setEndAt}
              disabled={isSubmitting}
              disablePastDates={false}
            />
          </div>
        </form>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { handleReset(); onOpenChange(false) }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            onClick={handleSubmit}
          >
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {initialData?.taskId ? "Salvar tarefa" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
