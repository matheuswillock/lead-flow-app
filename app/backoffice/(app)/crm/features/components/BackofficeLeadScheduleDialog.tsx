"use client"

import { useEffect, useState } from "react"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTimezone } from "@/app/context/TimezoneContext"
import type {
  BackofficeCrmUserOption,
  BackofficeLeadScheduleInput,
} from "../context/BackofficeCrmTypes"

export interface BackofficeLeadScheduleDialogLead {
  name: string
  closerBackofficeUserId: string | null
  meetingDate: string | null
  meetingTitle: string | null
  meetingNotes: string | null
  meetingLink: string | null
}

interface BackofficeLeadScheduleDialogProps {
  open: boolean
  lead: BackofficeLeadScheduleDialogLead | null
  closerOptions: BackofficeCrmUserOption[]
  onOpenChange: (open: boolean) => void
  onConfirm: (input: BackofficeLeadScheduleInput) => Promise<void>
}

function parseInitialDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function BackofficeLeadScheduleDialog({
  open,
  lead,
  closerOptions,
  onOpenChange,
  onConfirm,
}: BackofficeLeadScheduleDialogProps) {
  const { tz } = useTimezone()
  const [meetingDate, setMeetingDate] = useState<Date | undefined>()
  const [closerId, setCloserId] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [link, setLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setMeetingDate(parseInitialDate(lead?.meetingDate ?? null))
    setCloserId(lead?.closerBackofficeUserId ?? "")
    setTitle(lead?.meetingTitle ?? (lead?.name ? `Agendamento - ${lead.name}` : ""))
    setNotes(lead?.meetingNotes ?? "")
    setLink(lead?.meetingLink ?? "")
  }, [lead, open])

  const canSubmit = Boolean(meetingDate && closerId) && !isSubmitting

  async function handleSubmit() {
    if (!meetingDate) {
      toast.error("Informe a data do agendamento")
      return
    }
    if (!closerId) {
      toast.error("Selecione um closer")
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm({
        meetingDate: meetingDate.toISOString(),
        closerBackofficeUserId: closerId,
        meetingTitle: title.trim() || null,
        meetingNotes: notes.trim() || null,
        meetingLink: link.trim() || null,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("[BackofficeLeadScheduleDialog][submit]", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar agendamento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock data-icon="inline-start" />
            Agendar lead
          </DialogTitle>
          <DialogDescription>
            Informe a data e o closer antes de marcar o lead como agendado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <DateTimePicker
            date={meetingDate}
            onDateChange={setMeetingDate}
            label="Data do agendamento"
            required
            invalid={!meetingDate}
            disabled={isSubmitting}
            disablePastDates
            tz={tz}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="backoffice-schedule-closer">Closer *</Label>
            <Select value={closerId} onValueChange={setCloserId} disabled={isSubmitting}>
              <SelectTrigger id="backoffice-schedule-closer" aria-invalid={!closerId}>
                <SelectValue placeholder="Selecione o closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {closerOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {!closerId ? (
              <p className="text-xs font-medium text-destructive">
                Selecione um closer para confirmar o agendamento.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="backoffice-schedule-title">Título</Label>
              <Input
                id="backoffice-schedule-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                placeholder="Título do agendamento"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="backoffice-schedule-link">Link</Label>
              <Input
                id="backoffice-schedule-link"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                disabled={isSubmitting}
                placeholder="https://meet..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="backoffice-schedule-notes">Notas</Label>
            <Textarea
              id="backoffice-schedule-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isSubmitting}
              placeholder="Notas internas do agendamento"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Salvando..." : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
