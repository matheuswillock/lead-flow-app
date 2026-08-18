"use client"

import { useMemo } from "react"
import { Loader2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT,
  BACKOFFICE_LEAD_EXTRACTION_LIMIT_MAX,
  BACKOFFICE_LEAD_EXTRACTION_LIMIT_MIN,
  clampLeadExtractionLimit,
} from "@/lib/backoffice/lead-extraction-constants"
import { getMunicipalitiesForStates } from "../data/ibge-municipalities"
import {
  LEAD_EXTRACTION_REGION_PRESETS,
  isRegionFullySelected,
} from "../data/region-presets"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"
import { CnaeCombobox } from "./CnaeCombobox"
import { DateRangeFilter } from "./DateRangeFilter"
import { MultiCheckboxSelect } from "./MultiCheckboxSelect"

const STATE_OPTIONS = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "PR", label: "PR — Paraná" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "TO", label: "TO — Tocantins" },
]

const NATURE_OPTIONS = [
  { value: "2135", label: "EI — Empresário Individual" },
  { value: "2062", label: "EIRELI" },
  { value: "2063", label: "LTDA — Sociedade Limitada" },
  { value: "2244", label: "MEI — Microempreendedor Individual" },
  { value: "2057", label: "SA — Sociedade Anônima Fechada" },
  { value: "2058", label: "SA — Sociedade Anônima Aberta" },
  { value: "2054", label: "Sociedade Simples Limitada" },
  { value: "2143", label: "Cooperativa" },
]

const SIZE_OPTIONS = [
  { value: "1", label: "ME — Microempresa" },
  { value: "3", label: "EPP — Pequeno Porte" },
  { value: "5", label: "Demais" },
]

export function FilterSidebar() {
  const {
    filters,
    setFilters,
    isSearching,
    handleSearch,
    clearFilters,
  } = useBackofficeLeadExtraction()

  function update<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const cityOptions = useMemo(
    () =>
      getMunicipalitiesForStates(filters.states, filters.municipalityCodes).map(
        (municipality) => ({
          value: municipality.code,
          label: `${municipality.name} — ${municipality.uf}`,
        })
      ),
    [filters.states, filters.municipalityCodes]
  )

  function toggleRegion(regionCodes: string[]) {
    update(
      "municipalityCodes",
      isRegionFullySelected(filters.municipalityCodes, regionCodes)
        ? filters.municipalityCodes.filter((code) => !regionCodes.includes(code))
        : Array.from(new Set([...filters.municipalityCodes, ...regionCodes]))
    )
  }

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-1 flex-col overflow-y-auto p-4">

        <div className="mb-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Ramo de atividade (CNAE)</Label>
          <CnaeCombobox
            value={filters.mainCnae}
            onChange={(v) => update("mainCnae", v)}
          />
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Estado (UF)</Label>
          <MultiCheckboxSelect
            options={STATE_OPTIONS}
            values={filters.states}
            onChange={(v) => update("states", v)}
            placeholder="Selecionar estados..."
            searchPlaceholder="Pesquisar UF..."
          />
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Região</Label>
          <div className="flex flex-col gap-2">
            {LEAD_EXTRACTION_REGION_PRESETS.map((preset) => {
              const selected = isRegionFullySelected(
                filters.municipalityCodes,
                preset.municipalityCodes
              )
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant={selected ? "secondary" : "outline"}
                  className={cn("w-full justify-start font-normal", selected && "border-primary")}
                  onClick={() => toggleRegion(preset.municipalityCodes)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="mb-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Cidade</Label>
          <MultiCheckboxSelect
            options={cityOptions}
            values={filters.municipalityCodes}
            onChange={(v) => update("municipalityCodes", v)}
            placeholder={
              filters.states.length === 0 && filters.municipalityCodes.length === 0
                ? "Selecione um estado ou região"
                : "Selecionar cidades..."
            }
            searchPlaceholder="Pesquisar cidade..."
          />
        </div>

        <Separator className="mb-4" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Características</span>
          <button
            onClick={clearFilters}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Situação cadastral</Label>
          <Badge variant="secondary">Ativa</Badge>
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Natureza jurídica</Label>
          <MultiCheckboxSelect
            options={NATURE_OPTIONS}
            values={filters.natureIds}
            onChange={(v) => update("natureIds", v)}
            placeholder="Qualquer natureza"
          />
        </div>

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Porte</Label>
          <MultiCheckboxSelect
            options={SIZE_OPTIONS}
            values={filters.sizeIds}
            onChange={(v) => update("sizeIds", v)}
            placeholder="Qualquer porte"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Simples Nacional</Label>
            <Select value={filters.simplesOptant} onValueChange={(v) => update("simplesOptant", v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Optante</SelectItem>
                <SelectItem value="false">Não optante</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">MEI</Label>
            <Select value={filters.simeiOptant} onValueChange={(v) => update("simeiOptant", v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enquadrado</SelectItem>
                <SelectItem value="false">Não enquadrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="mb-4" />

        <div className="mb-3">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Data de abertura</Label>
          <DateRangeFilter
            from={filters.foundedGte}
            to={filters.foundedLte}
            onChange={(from, to) => setFilters((prev) => ({ ...prev, foundedGte: from, foundedLte: to }))}
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Checkbox
            id="hasPhone"
            checked={filters.hasPhone}
            onCheckedChange={(v) => update("hasPhone", v === true)}
          />
          <Label htmlFor="hasPhone" className="cursor-pointer text-sm font-normal">
            Apenas com telefone
          </Label>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id="hasEmail"
            checked={filters.hasEmail}
            onCheckedChange={(v) => update("hasEmail", v === true)}
          />
          <Label htmlFor="hasEmail" className="cursor-pointer text-sm font-normal">
            Apenas com e-mail
          </Label>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            <span className="text-base">⚡</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Remover contadores</p>
              <p className="text-xs text-muted-foreground">Exclui empresas de contabilidade e auditoria dos resultados</p>
            </div>
            <Switch
              checked={filters.removeContadores}
              onCheckedChange={(v) => update("removeContadores", v)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-extraction-limit" className="text-xs text-muted-foreground">
            Quantidade de leads
          </Label>
          <Input
            id="lead-extraction-limit"
            type="number"
            min={BACKOFFICE_LEAD_EXTRACTION_LIMIT_MIN}
            max={BACKOFFICE_LEAD_EXTRACTION_LIMIT_MAX}
            value={filters.limit}
            onChange={(event) => {
              const next = Number(event.target.value)
              update(
                "limit",
                Number.isFinite(next) ? next : BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT
              )
            }}
            onBlur={() => update("limit", clampLeadExtractionLimit(filters.limit))}
          />
        </div>
        <Button
          className="w-full"
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Search data-icon="inline-start" />
          )}
          {isSearching ? "Pesquisando…" : "Pesquisar"}
        </Button>
      </div>
    </aside>
  )
}
