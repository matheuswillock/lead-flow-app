"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  detectBrowserTimezone,
  formatLocalDateValue,
  formatLocalTimeValue,
  parseDateKeyAndTimeToUtc,
  resolveDayScheduleFloor,
  resolveTimeAtOrAfterFloor,
} from "@/lib/dates"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "./input"
import { Spinner } from "./spinner"

/**
 * Existe alguma regra de dia a aplicar no calendário?
 *
 * Precisa listar TODA restrição de dia. Um piso que não aparece aqui vira prop
 * que promete e não cumpre: o predicado nem chega a ser passado ao `Calendar` e
 * o calendário libera tudo. Foi o caso de `minDateTime` combinado com
 * `disablePastDates={false}` (achado do Codex no PR #1177).
 */
export function hasCalendarDayRestriction(params: {
  disablePastDates: boolean
  minDateKey?: string
  availableDateKeys?: string[]
  maxDateKey?: string
}): boolean {
  return Boolean(
    params.disablePastDates ||
      params.minDateKey ||
      params.availableDateKeys ||
      params.maxDateKey
  )
}

interface DateTimePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  disabled?: boolean
  disablePastDates?: boolean
  className?: string
  label?: string
  required?: boolean
  availableTimes?: string[]
  availableDateKeys?: string[]
  maxDateKey?: string
  showTime?: boolean
  timeLoading?: boolean
  timeLoadingText?: string
  invalid?: boolean
  tz?: string
  /**
   * Piso de agendamento (opt-in). Quando presente: dias anteriores ao piso
   * ficam desabilitados, horários vencidos do dia do piso saem da lista/ganham
   * `min`, o horário default nunca nasce vencido e um valor abaixo do piso é
   * apontado com mensagem inline no próprio campo.
   *
   * Sem esta prop o componente mantém o comportamento anterior intacto.
   */
  minDateTime?: Date
}

export function DateTimePicker({
  date,
  onDateChange,
  disabled = false,
  disablePastDates = true,
  className,
  label = "Data e Hora",
  required = false,
  availableTimes,
  availableDateKeys,
  maxDateKey,
  showTime = true,
  timeLoading = false,
  timeLoadingText = "Carregando...",
  invalid = false,
  tz,
  minDateTime,
}: DateTimePickerProps) {
  const resolvedTz = tz ?? detectBrowserTimezone()
  const timeSelectWidthClass = "w-full sm:w-[7.5rem]"
  const initialDate = date && isValid(date) ? date : undefined
  const toCalendarDate = React.useCallback(
    (value: Date) => {
      const [year, month, day] = formatLocalDateValue(value, resolvedTz).split("-").map(Number)
      return new Date(year, month - 1, day, 12, 0, 0, 0)
    },
    [resolvedTz]
  )
  const toCalendarDateKey = React.useCallback((value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(initialDate)
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<Date | undefined>(
    initialDate ? toCalendarDate(initialDate) : undefined
  )
  const [time, setTime] = React.useState<string>(
    initialDate && showTime ? formatLocalTimeValue(initialDate, resolvedTz) : showTime ? "10:00" : "00:00"
  )

  React.useEffect(() => {
    if (date && isValid(date)) {
      const nextDate = new Date(date)
      setTime(showTime ? formatLocalTimeValue(nextDate, resolvedTz) : "00:00")
      setSelectedDate(nextDate)
      setSelectedCalendarDate(toCalendarDate(nextDate))
      return
    }

    if (!date) {
      setSelectedDate(undefined)
      setSelectedCalendarDate(undefined)
      setTime(showTime ? "10:00" : "00:00")
    }
  }, [date, resolvedTz, showTime, toCalendarDate])

  const updateSelectedDate = React.useCallback(
    (dateKey: string, timeValue: string) => {
      const nextDate = parseDateKeyAndTimeToUtc(dateKey, showTime ? timeValue : "00:00", resolvedTz)
      setSelectedDate(nextDate)
      onDateChange(nextDate)
    },
    [onDateChange, resolvedTz, showTime]
  )

  const selectedDateKey = selectedCalendarDate
    ? toCalendarDateKey(selectedCalendarDate)
    : undefined

  /** Piso aplicado ao dia selecionado — `undefined` quando não há piso. */
  const selectedDayFloor = React.useMemo(() => {
    if (!minDateTime || !selectedDateKey) return undefined
    return resolveDayScheduleFloor({ dateKey: selectedDateKey, tz: resolvedTz, minDateTime })
  }, [minDateTime, resolvedTz, selectedDateKey])

  /** Slots realmente ofertáveis: sem piso, é a lista original sem cópia. */
  const selectableTimes = React.useMemo(() => {
    if (!availableTimes) return undefined
    if (!selectedDayFloor || selectedDayFloor.kind === "unrestricted") return availableTimes
    if (selectedDayFloor.kind === "noTimeAvailable") return []
    const earliest = selectedDayFloor.time
    return availableTimes.filter((slot) => slot >= earliest)
  }, [availableTimes, selectedDayFloor])

  React.useEffect(() => {
    if (!showTime) return
    if (!selectableTimes || selectableTimes.length === 0) return
    if (!selectableTimes.includes(time)) {
      const nextTime = selectableTimes[0]
      setTime(nextTime)
      if (selectedCalendarDate) {
        updateSelectedDate(toCalendarDateKey(selectedCalendarDate), nextTime)
      }
    }
  }, [selectableTimes, selectedCalendarDate, time, toCalendarDateKey, updateSelectedDate, showTime])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      setSelectedCalendarDate(undefined)
      onDateChange(undefined)
      return
    }

    const normalizedCalendarDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      12,
      0,
      0,
      0
    )
    setSelectedCalendarDate(normalizedCalendarDate)

    // O horário default ("10:00") não pode nascer vencido quando o dia
    // escolhido é o do piso — origem do agendamento no passado.
    const dateKey = toCalendarDateKey(normalizedCalendarDate)
    const effectiveTime = minDateTime
      ? resolveTimeAtOrAfterFloor({
          preferredTime: time,
          dateKey,
          tz: resolvedTz,
          minDateTime,
        })
      : time
    if (effectiveTime !== time) setTime(effectiveTime)
    updateSelectedDate(dateKey, effectiveTime)
  }

  const handleTimeChange = (newTime: string) => {
    if (!showTime) return
    setTime(newTime)

    if (selectedCalendarDate) {
      updateSelectedDate(toCalendarDateKey(selectedCalendarDate), newTime)
    }
  }

  const todayDateKey = formatLocalDateValue(new Date(), resolvedTz)
  const minDateKey = minDateTime ? formatLocalDateValue(minDateTime, resolvedTz) : undefined
  const availableDateKeySet = React.useMemo(
    () => (availableDateKeys ? new Set(availableDateKeys) : undefined),
    [availableDateKeys]
  )
  const isDateDisabled = React.useCallback(
    (candidate: Date) => {
      const candidateKey = toCalendarDateKey(candidate)
      if (disablePastDates && candidateKey < todayDateKey) return true
      if (minDateKey && candidateKey < minDateKey) return true
      if (maxDateKey && candidateKey > maxDateKey) return true
      if (availableDateKeySet && !availableDateKeySet.has(candidateKey)) return true
      return false
    },
    [availableDateKeySet, disablePastDates, maxDateKey, minDateKey, toCalendarDateKey, todayDateKey]
  )

  /** Único juiz de validade: comparação direta contra o piso. */
  const isBelowMinDateTime = Boolean(
    minDateTime && selectedDate && selectedDate.getTime() < minDateTime.getTime()
  )
  const floorMessage =
    isBelowMinDateTime && selectedDayFloor?.kind === "earliestTime"
      ? `Horário já passou. Escolha a partir de ${selectedDayFloor.time}.`
      : isBelowMinDateTime
        ? "Data e hora já passaram. Escolha um momento no futuro."
        : undefined
  const isInvalid = invalid || isBelowMinDateTime
  const timeSlots = selectableTimes ?? []

  return (
    <div className={cn("grid gap-1", className)}>
      {label && (
        <Label className="block text-sm font-medium mb-1 px-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="flex flex-col sm:flex-row sm:gap-4">
        {/* Date Picker */}
        <div className="flex flex-col">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-picker"
                variant="outline"
                className={cn(
                  "h-9 max-lg:h-11 w-full sm:w-45 justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground",
                  isInvalid && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={disabled}
                aria-invalid={isInvalid || undefined}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedCalendarDate && isValid(selectedCalendarDate) ? (
                  format(selectedCalendarDate, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Selecione</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedCalendarDate}
                onSelect={handleDateSelect}
                weekdayLabelFormat="short"
                disabled={
                  hasCalendarDayRestriction({
                    disablePastDates,
                    minDateKey,
                    availableDateKeys,
                    maxDateKey,
                  })
                    ? isDateDisabled
                    : undefined
                }
                initialFocus
                locale={ptBR}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2030}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Picker */}
        {showTime && (
          <div className="flex flex-col gap-2">
            {availableTimes ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={time}
                    onValueChange={handleTimeChange}
                    disabled={disabled || timeSlots.length === 0}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-9 max-lg:h-11 transition-colors hover:bg-accent/40 hover:text-accent-foreground",
                        timeSelectWidthClass,
                        isInvalid && "border-destructive focus-visible:ring-destructive"
                      )}
                      aria-invalid={isInvalid || undefined}
                    >
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(
                        timeSelectWidthClass,
                        "dialog-scrollbar max-h-72 min-w-(--radix-select-trigger-width) overscroll-contain"
                      )}
                      sideOffset={4}
                    >
                      <SelectGroup>
                        {timeSlots.map((slot) => (
                          <SelectItem
                            key={slot}
                            value={slot}
                            className="cursor-pointer hover:bg-accent hover:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                          >
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {timeLoading && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Spinner className="size-3" />
                      <span>{timeLoadingText}</span>
                    </div>
                  )}
                </div>
                {timeSlots.length === 0 && selectedDate && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum horário disponível para este dia.
                  </p>
                )}
              </>
            ) : (
              <Input
                id="time-picker"
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={disabled}
                min={
                  selectedDayFloor?.kind === "earliestTime" ? selectedDayFloor.time : undefined
                }
                className={cn(
                  "flex h-9 max-lg:h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                  "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                  isInvalid && "border-destructive focus-visible:ring-destructive"
                )}
                required={required}
                aria-invalid={isInvalid || undefined}
              />
            )}
          </div>
        )}
      </div>
      {floorMessage ? (
        <p className="px-1 text-sm text-destructive" role="alert">
          {floorMessage}
        </p>
      ) : null}
    </div>
  )
}
