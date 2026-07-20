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

  React.useEffect(() => {
    if (!showTime) return
    if (!availableTimes || availableTimes.length === 0) return
    if (!availableTimes.includes(time)) {
      const nextTime = availableTimes[0]
      setTime(nextTime)
      if (selectedCalendarDate) {
        updateSelectedDate(toCalendarDateKey(selectedCalendarDate), nextTime)
      }
    }
  }, [availableTimes, selectedCalendarDate, time, toCalendarDateKey, updateSelectedDate, showTime])

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
    updateSelectedDate(toCalendarDateKey(normalizedCalendarDate), time)
  }

  const handleTimeChange = (newTime: string) => {
    if (!showTime) return
    setTime(newTime)

    if (selectedCalendarDate) {
      updateSelectedDate(toCalendarDateKey(selectedCalendarDate), newTime)
    }
  }

  const todayDateKey = formatLocalDateValue(new Date(), resolvedTz)
  const availableDateKeySet = React.useMemo(
    () => (availableDateKeys ? new Set(availableDateKeys) : undefined),
    [availableDateKeys]
  )
  const isDateDisabled = React.useCallback(
    (candidate: Date) => {
      const candidateKey = toCalendarDateKey(candidate)
      if (disablePastDates && candidateKey < todayDateKey) return true
      if (maxDateKey && candidateKey > maxDateKey) return true
      if (availableDateKeySet && !availableDateKeySet.has(candidateKey)) return true
      return false
    },
    [availableDateKeySet, disablePastDates, maxDateKey, toCalendarDateKey, todayDateKey]
  )

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
                  "h-9 w-full sm:w-45 justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground",
                  invalid && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={disabled}
                aria-invalid={invalid || undefined}
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
                  disablePastDates || availableDateKeySet || maxDateKey ? isDateDisabled : undefined
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
                    disabled={disabled || availableTimes.length === 0}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-9 transition-colors hover:bg-accent/40 hover:text-accent-foreground",
                        timeSelectWidthClass,
                        invalid && "border-destructive focus-visible:ring-destructive"
                      )}
                      aria-invalid={invalid || undefined}
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
                        {availableTimes.map((slot) => (
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
                {availableTimes.length === 0 && selectedDate && (
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
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                  "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                  invalid && "border-destructive focus-visible:ring-destructive"
                )}
                required={required}
                aria-invalid={invalid || undefined}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
