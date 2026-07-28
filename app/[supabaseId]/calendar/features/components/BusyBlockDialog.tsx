"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { cn } from "@/lib/utils"
import {
  formatLocalDateValue,
  formatLocalTimeValue,
  parseDateKeyAndTimeToUtc,
  parseDateKeyToUtc,
} from "@/lib/dates"
import type { CloserBusyBlockItem, UpsertCloserBusyBlockPayload } from "../services/ICloserBusyBlockService"

const WEEKDAY_OPTIONS = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
] as const

const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, index) => {
  const total = index * 30
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
})

export type BusyBlockCloserOption = {
  id: string
  name: string
  googleCalendarConnected?: boolean
}

type BusyBlockDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  timezone: string
  closers: BusyBlockCloserOption[]
  canSelectCloser: boolean
  defaultProfileId: string
  editing: CloserBusyBlockItem | null
  saving: boolean
  onSubmit: (payload: UpsertCloserBusyBlockPayload) => Promise<void>
}

export function BusyBlockDialog({
  open,
  onOpenChange,
  timezone,
  closers,
  canSelectCloser,
  defaultProfileId,
  editing,
  saving,
  onSubmit,
}: BusyBlockDialogProps) {
  const [profileId, setProfileId] = React.useState(defaultProfileId)
  const [allDay, setAllDay] = React.useState(true)
  const [isRecurring, setIsRecurring] = React.useState(false)
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [syncToGoogle, setSyncToGoogle] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = React.useState("09:00")
  const [endTime, setEndTime] = React.useState("18:00")
  const [recurrenceEndsAt, setRecurrenceEndsAt] = React.useState<Date | undefined>(undefined)

  React.useEffect(() => {
    if (!open) return

    if (editing) {
      const start = new Date(editing.startsAt)
      const end = new Date(editing.endsAt)
      setProfileId(editing.profileId)
      setAllDay(editing.allDay)
      setIsRecurring(editing.isRecurring)
      setWeekdays(editing.weekdays)
      setSyncToGoogle(editing.syncToGoogle)
      setReason(editing.reason ?? "")
      setStartDate(start)
      setEndDate(
        editing.allDay
          ? new Date(end.getTime() - 1)
          : end
      )
      setStartTime(formatLocalTimeValue(start, timezone))
      setEndTime(formatLocalTimeValue(end, timezone))
      setRecurrenceEndsAt(
        editing.recurrenceEndsAt ? new Date(editing.recurrenceEndsAt) : undefined
      )
      return
    }

    const now = new Date()
    setProfileId(defaultProfileId)
    setAllDay(true)
    setIsRecurring(false)
    setWeekdays([])
    setSyncToGoogle(false)
    setReason("")
    setStartDate(now)
    setEndDate(now)
    setStartTime("09:00")
    setEndTime("18:00")
    setRecurrenceEndsAt(undefined)
  }, [open, editing, defaultProfileId, timezone])

  const selectedCloser = closers.find((closer) => closer.id === profileId)
  const googleConnected = selectedCloser?.googleCalendarConnected === true

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  const handleSubmit = async () => {
    if (!startDate || !endDate) return

    const startKey = formatLocalDateValue(startDate, timezone)
    const endKey = formatLocalDateValue(endDate, timezone)

    let startsAt: Date
    let endsAt: Date

    if (allDay) {
      startsAt = parseDateKeyToUtc(startKey, timezone)
      endsAt = parseDateKeyToUtc(endKey, timezone)
    } else {
      startsAt = parseDateKeyAndTimeToUtc(startKey, startTime, timezone)
      endsAt = parseDateKeyAndTimeToUtc(endKey, endTime, timezone)
    }

    const payload: UpsertCloserBusyBlockPayload = {
      profileId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allDay,
      isRecurring,
      weekdays: isRecurring ? weekdays : [],
      recurrenceEndsAt:
        isRecurring && recurrenceEndsAt
          ? parseDateKeyToUtc(formatLocalDateValue(recurrenceEndsAt, timezone), timezone).toISOString()
          : null,
      syncToGoogle: syncToGoogle && googleConnected,
      reason: reason.trim() || null,
    }

    await onSubmit(payload)
  }

  const canSave =
    Boolean(profileId && startDate && endDate) &&
    (!isRecurring || (weekdays.length > 0 && Boolean(recurrenceEndsAt))) &&
    (!syncToGoogle || googleConnected) &&
    !saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ocupação" : "Marcar período ocupado"}</DialogTitle>
          <DialogDescription>
            Neste intervalo o closer não recebe novos agendamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            {canSelectCloser && (
              <Field>
                <FieldLabel>Closer</FieldLabel>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.map((closer) => (
                      <SelectItem key={closer.id} value={closer.id}>
                        {closer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field orientation="horizontal" className="items-center justify-between">
              <FieldLabel htmlFor="busy-all-day">Dia inteiro</FieldLabel>
              <Switch id="busy-all-day" checked={allDay} onCheckedChange={setAllDay} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Início</FieldLabel>
                <DateTimePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  label={undefined}
                />
              </Field>
              <Field>
                <FieldLabel>Fim</FieldLabel>
                <DateTimePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  label={undefined}
                />
              </Field>
            </div>

            {!allDay && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Hora início</FieldLabel>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Hora fim</FieldLabel>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            <Field orientation="horizontal" className="items-center justify-between">
              <FieldLabel htmlFor="busy-recurring">Recorrente</FieldLabel>
              <Switch id="busy-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
            </Field>

            {isRecurring && (
              <>
                <Field>
                  <FieldLabel>Dias da semana</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={weekdays.includes(day.value) ? "default" : "outline"}
                        className="size-9 p-0"
                        onClick={() => toggleWeekday(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Repete até</FieldLabel>
                  <DateTimePicker
                    date={recurrenceEndsAt}
                    onDateChange={setRecurrenceEndsAt}
                    label={undefined}
                  />
                </Field>
              </>
            )}

            <Field>
              <FieldLabel>Onde bloquear</FieldLabel>
              <RadioGroup
                value={syncToGoogle ? "studio-google" : "studio"}
                onValueChange={(value) => setSyncToGoogle(value === "studio-google")}
                className="gap-3"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="studio" id="busy-studio" />
                  <Label htmlFor="busy-studio" className="font-normal">
                    Apenas Corretor Studio
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem
                    value="studio-google"
                    id="busy-studio-google"
                    disabled={!googleConnected}
                  />
                  <Label
                    htmlFor="busy-studio-google"
                    className={cn("font-normal", !googleConnected && "text-muted-foreground")}
                  >
                    Corretor Studio + Google Calendar
                    {!googleConnected && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Closer sem Google conectado.
                      </span>
                    )}
                  </Label>
                </div>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel>Motivo (opcional)</FieldLabel>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Férias, treinamento..."
                maxLength={500}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSave}>
            {saving ? "Salvando..." : "Salvar ocupação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
