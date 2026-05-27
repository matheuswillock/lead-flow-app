"use client"

import { useEffect, useState } from "react"
import { CalendarClock, X } from "lucide-react"
import { toast } from "sonner"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink"
import { formatLocalDateValue } from "@/lib/dates"
import type {
  BackofficeCrmUserOption,
  BackofficeLeadScheduleInput,
} from "../context/BackofficeCrmTypes"

const DEFAULT_MEETING_TITLE = "Demonstração Corretor Studio"

export interface BackofficeLeadScheduleDialogLead {
  id?: string | null
  name: string
  closerBackofficeUserId: string | null
  meetingDate: string | null
  meetingTitle: string | null
  meetingNotes: string | null
  meetingLink: string | null
  meetingExtraGuests: string[]
}

interface BackofficeLeadScheduleDialogProps {
  open: boolean
  lead: BackofficeLeadScheduleDialogLead | null
  closerOptions: BackofficeCrmUserOption[]
  guestOptions: BackofficeCrmUserOption[]
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
  guestOptions,
  onOpenChange,
  onConfirm,
}: BackofficeLeadScheduleDialogProps) {
  const [meetingDate, setMeetingDate] = useState<Date | undefined>()
  const [closerId, setCloserId] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [link, setLink] = useState("")
  const [extraGuests, setExtraGuests] = useState<string[]>([])
  const [extraGuestsDraft, setExtraGuestsDraft] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setMeetingDate(parseInitialDate(lead?.meetingDate ?? null))
    setCloserId(lead?.closerBackofficeUserId ?? "")
    setTitle(lead?.meetingTitle ?? DEFAULT_MEETING_TITLE)
    setNotes(lead?.meetingNotes ?? "")
    setLink(lead?.meetingLink ?? "")
    setExtraGuests(lead?.meetingExtraGuests ?? [])
    setExtraGuestsDraft("")
    setAvailableTimes([])
  }, [lead, open])

  const selectedCloser = closerOptions.find((option) => option.id === closerId) ?? null
  const closerTimezone = selectedCloser?.timezone ?? "America/Sao_Paulo"
  const meetingDateKey = meetingDate ? formatLocalDateValue(meetingDate, closerTimezone) : null

  // Busca os horários disponíveis quando closer + data estão selecionados
  useEffect(() => {
    if (!open || !closerId || !meetingDateKey) {
      setAvailableTimes([])
      setAvailabilityLoading(false)
      return
    }

    let cancelled = false
    setAvailabilityLoading(true)

    fetch("/api/v1/backoffice/calendar/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closerIds: [closerId],
        date: meetingDateKey,
        timezone: closerTimezone,
        excludeLeadId: lead?.id ?? null,
      }),
    })
      .then((res) => res.json() as Promise<{ isValid: boolean; result?: { availableTimes: string[] } }>)
      .then((data) => {
        if (cancelled) return
        setAvailableTimes(data.isValid ? (data.result?.availableTimes ?? []) : [])
      })
      .catch(() => {
        if (cancelled) return
        setAvailableTimes([])
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, closerId, meetingDateKey, closerTimezone, lead?.id])

  const requiresManualMeetingLink =
    !!selectedCloser && !selectedCloser.googleCalendarConnected
  const linkValidation = validateMeetingLinkValue(link, {
    required: requiresManualMeetingLink,
  })
  const canSubmit = Boolean(meetingDate && closerId && linkValidation.isValid) && !isSubmitting

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const addExtraGuests = (values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail)
    if (normalized.length === 0) return
    setExtraGuests((prev) => Array.from(new Set([...prev, ...normalized])))
  }

  const handleExtraGuestsInput = (value: string) => {
    if (!value) {
      setExtraGuestsDraft("")
      return
    }

    const parts = value.split(/[,;\s]+/)
    if (parts.length === 1) {
      setExtraGuestsDraft(value)
      return
    }

    const last = value.match(/[,\s;]$/) ? "" : parts.pop() || ""
    addExtraGuests(parts)
    setExtraGuestsDraft(last)
  }

  const commitExtraGuestDraft = () => {
    if (!extraGuestsDraft.trim()) return
    handleExtraGuestsInput(`${extraGuestsDraft} `)
  }

  async function handleSubmit() {
    if (!meetingDate) {
      toast.error("Informe a data do agendamento")
      return
    }
    if (!closerId) {
      toast.error("Selecione um closer")
      return
    }
    if (!linkValidation.isValid) {
      toast.error(linkValidation.error)
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm({
        meetingDate: meetingDate.toISOString(),
        closerBackofficeUserId: closerId,
        meetingTitle: title.trim() || null,
        meetingNotes: notes.trim() || null,
        meetingLink: linkValidation.normalized ?? (link.trim() || null),
        extraGuests,
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
            tz={closerTimezone}
            availableTimes={closerId ? availableTimes : undefined}
            timeLoading={availabilityLoading}
            timeLoadingText="Carregando horários disponíveis..."
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

          <div className="flex flex-col gap-4">
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
              <Label htmlFor="backoffice-schedule-link">
                Link {requiresManualMeetingLink ? "*" : ""}
              </Label>
              <Input
                id="backoffice-schedule-link"
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                disabled={isSubmitting || (!!selectedCloser?.googleCalendarConnected && !link.trim())}
                placeholder={
                  requiresManualMeetingLink
                    ? "https://meet..."
                    : "Gerado automaticamente pelo Google Meet"
                }
                aria-invalid={!linkValidation.isValid}
              />
              {requiresManualMeetingLink && !link.trim() ? (
                <p className="text-xs font-medium text-destructive">
                  Este closer não tem Google conectado. Informe um link manual.
                </p>
              ) : null}
              {selectedCloser?.googleCalendarConnected && !link.trim() ? (
                <p className="text-xs text-muted-foreground">
                  O evento será criado no Google Calendar do closer e o link será gerado automaticamente.
                </p>
              ) : null}
              {link.trim() && !linkValidation.isValid ? (
                <p className="text-xs font-medium text-destructive">
                  {linkValidation.error}
                </p>
              ) : null}
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="backoffice-schedule-extra-guests">
              Convidados extras
            </Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
              {extraGuests.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  <span>{email}</span>
                  <button
                    type="button"
                    className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                    onClick={() =>
                      setExtraGuests((prev) => prev.filter((item) => item !== email))
                    }
                    aria-label={`Remover ${email}`}
                    disabled={isSubmitting}
                  >
                    <X />
                  </button>
                </Badge>
              ))}
              <input
                id="backoffice-schedule-extra-guests"
                type="text"
                value={extraGuestsDraft}
                onChange={(event) => handleExtraGuestsInput(event.target.value)}
                onBlur={commitExtraGuestDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    commitExtraGuestDraft()
                  }
                }}
                disabled={isSubmitting}
                placeholder="convidado@email.com"
                className="min-w-35 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Adicionar usuários backoffice:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                    Selecionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {guestOptions
                    .filter((option) => option.email)
                    .map((option) => {
                      const email = option.email.toLowerCase()
                      const checked = extraGuests.includes(email)

                      return (
                        <DropdownMenuCheckboxItem
                          key={option.id}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            if (nextChecked) {
                              addExtraGuests([email])
                              return
                            }

                            setExtraGuests((prev) =>
                              prev.filter((item) => item !== email)
                            )
                          }}
                        >
                          {option.name}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-xs text-muted-foreground">
              Separe os e-mails por vírgula, ponto e vírgula ou espaço.
            </p>
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
