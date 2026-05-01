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
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import {
  BACKOFFICE_CRM_COLUMNS,
  isBackofficeCrmFiltersEmpty,
  type BackofficeCrmFiltersState,
  type BackofficeCrmUserOption,
  type BackofficeLeadStatusKey,
} from "../context/BackofficeCrmTypes"

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function BackofficeStatusFilter() {
  const { filters, setFilter } = useBackofficeCrm()

  const selectedSet = useMemo(
    () => new Set(filters.statusFilter),
    [filters.statusFilter]
  )
  const selectedLabels = useMemo(
    () =>
      BACKOFFICE_CRM_COLUMNS.filter((option) => selectedSet.has(option.key)).map(
        (option) => option.title
      ),
    [selectedSet]
  )
  const hasSelections = selectedLabels.length > 0

  function handleToggleStatus(value: BackofficeLeadStatusKey) {
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
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle data-icon="inline-start" />
          Status
          {hasSelections ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedLabels.length}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedLabels.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedLabels.length} selecionados
                  </Badge>
                ) : (
                  selectedLabels.map((label) => (
                    <Badge
                      variant="secondary"
                      key={label}
                      className="rounded-sm px-1 font-normal"
                    >
                      {label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Status" />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {BACKOFFICE_CRM_COLUMNS.map((option) => {
                const isSelected = selectedSet.has(option.key)
                return (
                  <CommandItem
                    key={option.key}
                    onSelect={() => handleToggleStatus(option.key)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <span>{option.title}</span>
                  </CommandItem>
                )
              })}
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

function BackofficeUserFilter({
  filterKey,
  label,
  options,
}: {
  filterKey: Extract<keyof BackofficeCrmFiltersState, "sdrFilter" | "closerFilter">
  label: string
  options: BackofficeCrmUserOption[]
}) {
  const { filters, setFilter } = useBackofficeCrm()
  const selectedSet = useMemo(() => new Set(filters[filterKey]), [filterKey, filters])
  const selectedLabels = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)).map((option) => option.name),
    [options, selectedSet]
  )
  const hasSelections = selectedLabels.length > 0

  function handleToggleUser(value: string) {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setFilter(filterKey, Array.from(next))
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
          {label}
          {hasSelections ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedLabels.length}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedLabels.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedLabels.length} selecionados
                  </Badge>
                ) : (
                  selectedLabels.map((selectedLabel) => (
                    <Badge
                      variant="secondary"
                      key={selectedLabel}
                      className="rounded-sm px-1 font-normal"
                    >
                      {selectedLabel}
                    </Badge>
                  ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.id)
                return (
                  <CommandItem
                    key={option.id}
                    value={`${option.name} ${option.email}`}
                    onSelect={() => handleToggleUser(option.id)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{option.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {option.email}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {hasSelections ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setFilter(filterKey, [])}
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

function BackofficeCreatedAtFilter() {
  const { filters, setFilters } = useBackofficeCrm()

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
          className={cn(
            "h-8 border-dashed",
            (dateRange?.from || dateRange?.to) && "border-primary"
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          Data de Criação
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
        {dateRange?.from || dateRange?.to ? (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => handleDateChange(undefined)}>
              Limpar filtro
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function BackofficeCrmFiltersBar() {
  const { filters, setFilter, clearFilters, sdrOptions, closerOptions } = useBackofficeCrm()
  const isFiltered = !isBackofficeCrmFiltersEmpty(filters)

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Filtrar por nome, e-mail, telefone ou CNPJ..."
          value={filters.query}
          onChange={(event) => setFilter("query", event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        <BackofficeStatusFilter />
        <BackofficeUserFilter
          filterKey="sdrFilter"
          label="SDR"
          options={sdrOptions}
        />
        <BackofficeUserFilter
          filterKey="closerFilter"
          label="Closer"
          options={closerOptions}
        />
        <BackofficeCreatedAtFilter />
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={clearFilters}
          >
            Limpar
            <X data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
