"use client"

import { useState } from "react"
import { format, isValid, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type RadarProfileFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  consentFilter: string
  onConsentFilterChange: (value: string) => void
  sourceFilter: string
  onSourceFilterChange: (value: string) => void
  channelFilter: string
  onChannelFilterChange: (value: string) => void
  lastSeenFrom: string
  onLastSeenFromChange: (value: string) => void
  lastSeenTo: string
  onLastSeenToChange: (value: string) => void
}

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return isValid(parsed) ? parsed : undefined
}

function DateFilterField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const selected = parseDateKey(value)

  return (
    <Field className="min-w-[11rem] gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !selected && "text-muted-foreground")}
          >
            <CalendarIcon data-icon="inline-start" />
            {selected ? format(selected, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
            locale={ptBR}
            captionLayout="dropdown"
            fromYear={2000}
            toYear={new Date().getFullYear() + 1}
          />
          {value ? (
            <div className="border-t p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange("")}>
                Limpar
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </Field>
  )
}

export function RadarProfileFilters({
  search,
  onSearchChange,
  consentFilter,
  onConsentFilterChange,
  sourceFilter,
  onSourceFilterChange,
  channelFilter,
  onChannelFilterChange,
  lastSeenFrom,
  onLastSeenFromChange,
  lastSeenTo,
  onLastSeenToChange,
}: RadarProfileFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fields = (
    <>
      <Input
        placeholder="Buscar nome, telefone ou e-mail"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select value={consentFilter || "__all"} onValueChange={(v) => onConsentFilterChange(v === "__all" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Consentimento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Consentimento</SelectItem>
          <SelectItem value="allowed">Apto</SelectItem>
          <SelectItem value="blocked">Bloqueado</SelectItem>
          <SelectItem value="unknown">Indefinido</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sourceFilter || "__all"} onValueChange={(v) => onSourceFilterChange(v === "__all" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Origem</SelectItem>
          <SelectItem value="crm_lead">CRM</SelectItem>
          <SelectItem value="portfolio">Carteira</SelectItem>
          <SelectItem value="email_contact">E-mail</SelectItem>
          <SelectItem value="whatsapp_contact">WhatsApp</SelectItem>
        </SelectContent>
      </Select>
      <Select value={channelFilter || "__all"} onValueChange={(v) => onChannelFilterChange(v === "__all" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Canal</SelectItem>
          <SelectItem value="email">E-mail</SelectItem>
          <SelectItem value="whatsapp">WhatsApp</SelectItem>
        </SelectContent>
      </Select>
      <DateFilterField
        label="Última interação a partir de"
        value={lastSeenFrom}
        onChange={onLastSeenFromChange}
      />
      <DateFilterField label="Última interação até" value={lastSeenTo} onChange={onLastSeenToChange} />
    </>
  )

  return (
    <>
      <div className="hidden flex-wrap items-end gap-2 md:flex">{fields}</div>

      <div className="flex md:hidden">
        <Button variant="outline" className="w-full" onClick={() => setFiltersOpen(true)}>
          <Filter data-icon="inline-start" />
          Filtros
        </Button>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            {fields}
            <Button onClick={() => setFiltersOpen(false)}>Aplicar filtros</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
