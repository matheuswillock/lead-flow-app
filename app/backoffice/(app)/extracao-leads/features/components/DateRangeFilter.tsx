"use client"

import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateRangeFilterProps {
  label: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

function toDateRange(from: string, to: string): DateRange | undefined {
  const f = from ? new Date(from + "T12:00:00") : undefined
  const t = to ? new Date(to + "T12:00:00") : undefined
  if (!f && !t) return undefined
  return { from: f, to: t }
}

function toIso(date: Date | undefined): string {
  if (!date) return ""
  return format(date, "yyyy-MM-dd")
}

export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  const range = toDateRange(from, to)

  function handleSelect(r: DateRange | undefined) {
    onChange(toIso(r?.from), toIso(r?.to))
  }

  const hasValue = !!from || !!to

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start font-normal", hasValue && "border-primary")}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-60" />
          {from && to ? (
            <span>{format(new Date(from + "T12:00:00"), "dd/MM/yy", { locale: ptBR })} – {format(new Date(to + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}</span>
          ) : from ? (
            <span>A partir de {format(new Date(from + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}</span>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          captionLayout="dropdown"
          fromYear={1900}
          toYear={new Date().getFullYear()}
          locale={ptBR}
          numberOfMonths={1}
          disabled={(date) => date > new Date()}
        />
        {hasValue && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange("", "")}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
