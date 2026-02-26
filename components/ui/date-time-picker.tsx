"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  disabled?: boolean
  disablePastDates?: boolean
  className?: string
  label?: string
  required?: boolean
  availableTimes?: string[]
  showTime?: boolean
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
  showTime = true,
}: DateTimePickerProps) {
  const initialDate = date && isValid(date) ? date : undefined
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(initialDate)
  const [time, setTime] = React.useState<string>(
    initialDate && showTime ? format(initialDate, "HH:mm") : showTime ? "10:00" : "00:00"
  )

  React.useEffect(() => {
    if (date && isValid(date)) {
      const nextDate = new Date(date)
      if (!showTime) {
        nextDate.setHours(0, 0, 0, 0)
        setTime("00:00")
      } else {
        setTime(format(nextDate, "HH:mm"))
      }
      setSelectedDate(nextDate)
      return
    }

    if (!date) {
      setSelectedDate(undefined)
      setTime(showTime ? "10:00" : "00:00")
    }
  }, [date, showTime])

  React.useEffect(() => {
    if (!showTime) return
    if (!availableTimes || availableTimes.length === 0) return
    if (!availableTimes.includes(time)) {
      const nextTime = availableTimes[0]
      setTime(nextTime)
      if (selectedDate) {
        const [hours, minutes] = nextTime.split(":").map(Number)
        const newDate = new Date(selectedDate)
        newDate.setHours(hours, minutes, 0, 0)
        setSelectedDate(newDate)
        onDateChange(newDate)
      }
    }
  }, [availableTimes, time, selectedDate, onDateChange])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      onDateChange(undefined)
      return
    }

    const [hours, minutes] = (showTime ? time : "00:00").split(":").map(Number)
    newDate.setHours(hours, minutes, 0, 0)
    setSelectedDate(newDate)
    onDateChange(newDate)
  }

  const handleTimeChange = (newTime: string) => {
    if (!showTime) return
    setTime(newTime)

    if (selectedDate) {
      const [hours, minutes] = newTime.split(":").map(Number)
      const newDate = new Date(selectedDate)
      newDate.setHours(hours, minutes, 0, 0)
      setSelectedDate(newDate)
      onDateChange(newDate)
    }
  }

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
                  "h-9 w-full sm:w-[180px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate && isValid(selectedDate) ? (
                  format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Selecione</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={
                  disablePastDates
                    ? (date: Date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
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
                <Select
                  value={time}
                  onValueChange={handleTimeChange}
                  disabled={disabled || availableTimes.length === 0}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimes.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableTimes.length === 0 && selectedDate && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum horário disponível para este dia.
                  </p>
                )}
              </>
            ) : (
              <input
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
                  "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                )}
                required={required}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
