"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { CalendarIcon, Check, PlusCircle, X } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useCronExecutions } from "../context/useCronExecutionsHook"
import {
  CRON_EXECUTION_STATUS_OPTIONS,
  isCronExecutionsFiltersEmpty,
  type CronExecutionStatusKey,
} from "../context/CronExecutionsContextTypes"

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
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

function SelectionSummary({ labels }: { labels: string[] }) {
  return (
    <>
      <Separator orientation="vertical" className="mx-2 h-4" />
      <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
        {labels.length}
      </Badge>
      <div className="hidden items-center gap-1 lg:flex">
        {labels.length > 2 ? (
          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
            {labels.length} selecionados
          </Badge>
        ) : (
          labels.map((label) => (
            <Badge variant="secondary" key={label} className="rounded-sm px-1 font-normal">
              {label}
            </Badge>
          ))
        )}
      </div>
    </>
  )
}

function BackofficeCronKeyFilter() {
  const { filters, setFilter, cronKeyOptions } = useCronExecutions()

  const selectedSet = useMemo(() => new Set(filters.cronKeyFilter), [filters.cronKeyFilter])
  const selectedLabels = useMemo(
    () => cronKeyOptions.filter((option) => selectedSet.has(option)),
    [cronKeyOptions, selectedSet]
  )
  const hasSelections = filters.cronKeyFilter.length > 0

  function handleToggleCronKey(value: string) {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setFilter("cronKeyFilter", Array.from(next))
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
          Cron
          {hasSelections ? <SelectionSummary labels={selectedLabels} /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cron" />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {cronKeyOptions.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => handleToggleCronKey(option)}>
                  <SelectionIndicator isSelected={selectedSet.has(option)} />
                  <span className="truncate font-mono text-xs">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {hasSelections ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setFilter("cronKeyFilter", [])}
                    className="justify-center text-center"
                  >
                    Limpar filtros
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

function BackofficeCronStatusFilter() {
  const { filters, setFilter } = useCronExecutions()

  const selectedSet = useMemo(
    () => new Set<CronExecutionStatusKey>(filters.statusFilter),
    [filters.statusFilter]
  )
  const selectedLabels = useMemo(
    () =>
      CRON_EXECUTION_STATUS_OPTIONS.filter((option) => selectedSet.has(option.key)).map(
        (option) => option.title
      ),
    [selectedSet]
  )
  const hasSelections = selectedLabels.length > 0

  function handleToggleStatus(value: CronExecutionStatusKey) {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setFilter("statusFilter", Array.from(next))
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
          Status
          {hasSelections ? <SelectionSummary labels={selectedLabels} /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Status" />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {CRON_EXECUTION_STATUS_OPTIONS.map((option) => (
                <CommandItem key={option.key} onSelect={() => handleToggleStatus(option.key)}>
                  <SelectionIndicator isSelected={selectedSet.has(option.key)} />
                  <span>{option.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {hasSelections ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setFilter("statusFilter", [])}
                    className="justify-center text-center"
                  >
                    Limpar filtros
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

function BackofficeCronPeriodFilter() {
  const { filters, setFilters } = useCronExecutions()

  const dateRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateKey(filters.periodStart)
    const to = parseDateKey(filters.periodEnd)
    return from ? { from, to } : undefined
  }, [filters.periodEnd, filters.periodStart])

  function handleDateChange(range: DateRange | undefined) {
    if (!range?.from) {
      setFilters({ ...filters, periodStart: "", periodEnd: "" })
      return
    }

    setFilters({
      ...filters,
      periodStart: format(range.from, "yyyy-MM-dd"),
      periodEnd: range.to ? format(range.to, "yyyy-MM-dd") : "",
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 border-dashed", dateRange?.from && "border-primary")}
        >
          <CalendarIcon data-icon="inline-start" />
          Período
          {dateRange?.from && dateRange?.to ? (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
              {format(dateRange.to, "dd/MM", { locale: ptBR })}
            </span>
          ) : null}
          {dateRange?.from && !dateRange?.to ? (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              A partir de {format(dateRange.from, "dd/MM", { locale: ptBR })}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleDateChange}
          weekdayLabelFormat="short"
          locale={ptBR}
          numberOfMonths={2}
          disabled={(date) => date > new Date()}
        />
        {dateRange?.from ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => handleDateChange(undefined)}
            >
              Limpar filtro
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function BackofficeCronExecutionsFiltersBar() {
  const { filters, setFilter, clearFilters } = useCronExecutions()
  const isFiltered = !isCronExecutionsFiltersEmpty(filters)

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por cron, rota ou erro..."
          value={filters.query}
          onChange={(event) => setFilter("query", event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        <BackofficeCronKeyFilter />
        <BackofficeCronStatusFilter />
        <BackofficeCronPeriodFilter />
        {isFiltered ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
            Limpar
            <X data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
