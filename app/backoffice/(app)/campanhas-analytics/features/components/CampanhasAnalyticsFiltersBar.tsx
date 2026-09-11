"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { AlertCircle, CalendarIcon, Check, PlusCircle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS } from "../utils/campaignAnalyticsRange"
import { CampanhasAnalyticsExportMenu } from "./CampanhasAnalyticsExportMenu"

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function SelectionIndicator({ isSelected }: { isSelected: boolean }) {
  return (
    <div
      className={cn(
        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
        isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
      )}
    >
      <Check className="size-4" />
    </div>
  )
}

function CampanhasAnalyticsPeriodFilter() {
  const { draftFilters, setDraftFilters, rangeValidationError } = useCampanhasAnalytics()

  const dateRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateKey(draftFilters.from)
    const to = parseDateKey(draftFilters.to)
    return from ? { from, to } : undefined
  }, [draftFilters.from, draftFilters.to])

  function applyRange(from: Date, to: Date) {
    setDraftFilters({ ...draftFilters, from: formatDateKey(from), to: formatDateKey(to) })
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range?.from) return
    applyRange(range.from, range.to ?? range.from)
  }

  const today = new Date()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", rangeValidationError && "border-destructive text-destructive")}
        >
          <CalendarIcon data-icon="inline-start" />
          Período
          <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
            {dateRange?.from ? format(dateRange.from, "dd/MM", { locale: ptBR }) : "—"} -{" "}
            {dateRange?.to ? format(dateRange.to, "dd/MM", { locale: ptBR }) : "—"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center gap-2 border-b p-2">
          <Button variant="ghost" size="sm" onClick={() => applyRange(subtractDays(today, 6), today)}>
            Últimos 7 dias
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyRange(subtractDays(today, 29), today)}>
            Últimos 30 dias
          </Button>
        </div>
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleCalendarSelect}
          weekdayLabelFormat="short"
          locale={ptBR}
          numberOfMonths={2}
          disabled={(date) => date > today}
        />
        {rangeValidationError ? (
          <div className="flex items-start gap-2 border-t p-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{rangeValidationError}</span>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function CampanhasAnalyticsTeamFilter() {
  const { draftFilters, setDraftFilters, teamOptions } = useCampanhasAnalytics()

  const selectedSet = useMemo(() => new Set(draftFilters.teamIds), [draftFilters.teamIds])
  const hasSelections = draftFilters.teamIds.length > 0

  function handleToggleTeam(teamId: string) {
    const next = new Set(selectedSet)
    if (next.has(teamId)) {
      next.delete(teamId)
    } else {
      next.add(teamId)
    }
    setDraftFilters({ ...draftFilters, teamIds: Array.from(next) })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", hasSelections && "border-primary")}
        >
          <PlusCircle data-icon="inline-start" />
          Times
          {hasSelections ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {draftFilters.teamIds.length} {draftFilters.teamIds.length === 1 ? "time" : "times"}
              </Badge>
            </>
          ) : (
            <span className="ml-2 text-xs text-muted-foreground">todos</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar time..." />
          <CommandList>
            <CommandEmpty>Nenhum time encontrado.</CommandEmpty>
            <CommandGroup>
              {teamOptions.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => handleToggleTeam(option.id)}>
                  <SelectionIndicator isSelected={selectedSet.has(option.id)} />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {hasSelections ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setDraftFilters({ ...draftFilters, teamIds: [] })}
                    className="justify-center text-center"
                  >
                    Selecionar todos os times
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function CampanhasAnalyticsFiltersBar() {
  const { isUpdating, rangeValidationError, refresh } = useCampanhasAnalytics()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CampanhasAnalyticsPeriodFilter />
      <CampanhasAnalyticsTeamFilter />
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={isUpdating || Boolean(rangeValidationError)}
        onClick={() => void refresh()}
      >
        <RefreshCw data-icon="inline-start" className={cn(isUpdating && "animate-spin")} />
        Atualizar
      </Button>
      <CampanhasAnalyticsExportMenu />
      {rangeValidationError ? (
        <span className="text-xs text-destructive" role="alert">
          {rangeValidationError}
        </span>
      ) : null}
      <span className="text-xs text-muted-foreground">
        Limite de {CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS} dias por consulta
      </span>
    </div>
  )
}
