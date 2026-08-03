"use client"

import { useState } from "react"
import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

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
      <Field>
        <FieldLabel>Interação a partir de</FieldLabel>
        <Input
          type="date"
          value={lastSeenFrom}
          onChange={(e) => onLastSeenFromChange(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>Interação até</FieldLabel>
        <Input
          type="date"
          value={lastSeenTo}
          onChange={(e) => onLastSeenToChange(e.target.value)}
        />
      </Field>
    </>
  )

  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">{fields}</div>

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
