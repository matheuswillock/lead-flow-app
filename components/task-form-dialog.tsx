"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { cn } from "@/lib/utils"
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO"

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

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  leadName: string
  teamMembers: UserAssociated[]
  supabaseId: string
  activeTeamId: string
  onSuccess?: (payload: TaskCreatedPayload) => void
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
}: TaskFormDialogProps) {
  const [body, setBody] = React.useState("")
  const [isUrgent, setIsUrgent] = React.useState(false)
  const [startAt, setStartAt] = React.useState<Date | undefined>(undefined)
  const [endAt, setEndAt] = React.useState<Date | undefined>(undefined)
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([])
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const selectedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id))

  const handleToggleAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

  const handleReset = () => {
    setBody("")
    setIsUrgent(false)
    setStartAt(undefined)
    setEndAt(undefined)
    setAssigneeIds([])
    setPopoverOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) {
      toast.error("Descrição da tarefa é obrigatória.")
      return
    }
    if (assigneeIds.length === 0) {
      toast.error("Selecione ao menos um responsável.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        type: "task",
        body: body.trim(),
        isUrgent,
        assigneeProfileIds: assigneeIds,
      }
      if (startAt) payload.startAt = startAt.toISOString()
      if (endAt) payload.endAt = endAt.toISOString()

      const response = await fetch(`/api/v1/leads/${leadId}/activities`, {
        method: "POST",
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

      toast.success("Tarefa criada com sucesso!")
      if (notSynced.length > 0) {
        toast.info(
          `${notSynced.length} responsável(is) sem Google Calendar conectado — tarefa criada internamente.`
        )
      }

      onSuccess?.({
        taskId: result.result?.task?.id,
        activityId: result.result?.activity?.id,
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
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Lead: {leadName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 dialog-scrollbar pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-body">Descrição</Label>
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
            <Label>Responsáveis</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  disabled={isSubmitting}
                  className="w-full justify-between"
                >
                  {selectedMembers.length === 0
                    ? "Selecionar responsáveis..."
                    : `${selectedMembers.length} selecionado(s)`}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar membro..." />
                  <CommandList>
                    <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                    <CommandGroup>
                      {teamMembers.map((member) => {
                        const isSelected = assigneeIds.includes(member.id)
                        return (
                          <CommandItem
                            key={member.id}
                            value={member.name + member.email}
                            onSelect={() => handleToggleAssignee(member.id)}
                          >
                            <Check
                              className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")}
                            />
                            <Avatar className="mr-2 size-6">
                              <AvatarImage src={member.avatarImageUrl} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{member.name || member.email}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <Badge key={m.id} variant="secondary" className="gap-1.5 pr-1">
                    <Avatar className="size-4">
                      <AvatarImage src={m.avatarImageUrl} />
                      <AvatarFallback className="text-[8px]">{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <span>{m.name || m.email}</span>
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:text-destructive"
                      onClick={() => handleToggleAssignee(m.id)}
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="task-urgent"
              checked={isUrgent}
              onCheckedChange={setIsUrgent}
              disabled={isSubmitting}
            />
            <Label htmlFor="task-urgent" className="cursor-pointer">
              Urgente
            </Label>
          </div>

          <div className="flex flex-col gap-3">
            <DateTimePicker
              label="Início (opcional)"
              date={startAt}
              onDateChange={setStartAt}
              disabled={isSubmitting}
              disablePastDates={false}
            />
            <DateTimePicker
              label="Fim (opcional)"
              date={endAt}
              onDateChange={(d) => {
                if (d && startAt && d < startAt) {
                  toast.error("A data de fim não pode ser anterior ao início.")
                  return
                }
                setEndAt(d)
              }}
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
            disabled={isSubmitting || !body.trim() || assigneeIds.length === 0}
            onClick={handleSubmit}
          >
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
