"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
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

interface DateTimePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  disabled?: boolean
  disablePastDates?: boolean
  className?: string
  label?: string
  required?: boolean
}

export function DateTimePicker({
  date,
  onDateChange,
  disabled = false,
  disablePastDates = true,
  className,
  label = "Data e Hora",
  required = false,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : "10:00"
  )

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setTime(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      onDateChange(undefined)
      return
    }

    const [hours, minutes] = time.split(":").map(Number)
    newDate.setHours(hours, minutes, 0, 0)
    setSelectedDate(newDate)
    onDateChange(newDate)
  }

  const handleTimeChange = (newTime: string) => {
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
    <div className={cn("grid gap-2", className)}>
      {label && (
        <Label className="block text-sm font-medium mb-1 px-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        {/* Date Picker */}
        <div className="flex flex-col gap-2">
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
                {selectedDate ? (
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
        <div className="flex flex-col gap-2">
          <input
            id="time-picker"
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full sm:w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            )}
            required={required}
          />
        </div>
      </div>
    </div>
  )
}
